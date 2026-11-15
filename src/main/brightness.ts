import { execFile } from 'child_process'
import { screen } from 'electron'
import type { AppConfig } from '@shared/types'
import { resolveDisplayTarget } from './displayManager'
import { listDisplays } from './displays'
import { levelToRaw, rawToPercent } from '@shared/brightnessMath'

export interface BrightnessProbe {
  supported: boolean
  /** 0-100, when supported. */
  percent?: number
  error?: string
}

/**
 * One-shot PowerShell script (placeholders: __X__ __Y__ = a point inside the
 * monitor in physical pixels, __MODE__ = get|set, __RAW__ = raw level for
 * set). Uses the Windows monitor-configuration API (DDC/CI). Prints one JSON
 * line. Many case/portable panels don't implement DDC/CI at all, which shows
 * up here as supported:false rather than an error.
 */
const SCRIPT = `
Add-Type @"
using System; using System.Runtime.InteropServices;
public class DDC {
  [StructLayout(LayoutKind.Sequential)] public struct PT { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public struct PM { public IntPtr H; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string D; }
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromPoint(PT p, uint f);
  [DllImport("dxva2.dll")] static extern bool GetNumberOfPhysicalMonitorsFromHMONITOR(IntPtr m, out uint n);
  [DllImport("dxva2.dll")] static extern bool GetPhysicalMonitorsFromHMONITOR(IntPtr m, uint n, [Out] PM[] a);
  [DllImport("dxva2.dll")] static extern bool GetMonitorBrightness(IntPtr h, out uint min, out uint cur, out uint max);
  [DllImport("dxva2.dll")] static extern bool SetMonitorBrightness(IntPtr h, uint v);
  [DllImport("dxva2.dll")] static extern bool DestroyPhysicalMonitors(uint n, [In] PM[] a);
  public static string Run(int x, int y, string mode, uint raw) {
    SetProcessDpiAwarenessContext(new IntPtr(-4));
    PT p; p.X = x; p.Y = y;
    IntPtr mon = MonitorFromPoint(p, 2);
    uint n; if (mon == IntPtr.Zero || !GetNumberOfPhysicalMonitorsFromHMONITOR(mon, out n) || n == 0) return "{\\"supported\\":false}";
    PM[] arr = new PM[n];
    if (!GetPhysicalMonitorsFromHMONITOR(mon, n, arr)) return "{\\"supported\\":false}";
    try {
      uint mn, cur, mx;
      if (!GetMonitorBrightness(arr[0].H, out mn, out cur, out mx)) return "{\\"supported\\":false}";
      if (mode == "set") {
        if (!SetMonitorBrightness(arr[0].H, raw)) return "{\\"supported\\":false}";
        cur = raw;
      }
      return "{\\"supported\\":true,\\"min\\":" + mn + ",\\"cur\\":" + cur + ",\\"max\\":" + mx + "}";
    } finally { DestroyPhysicalMonitors(n, arr); }
  }
}
"@
[DDC]::Run(__X__, __Y__, '__MODE__', __RAW__)
`

function run(script: string): Promise<string> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 15_000 },
      (err, stdout) => (err ? reject(err) : resolve(stdout.trim()))
    )
  })
}

interface DdcReply {
  supported: boolean
  min?: number
  cur?: number
  max?: number
}

async function call(
  point: { x: number; y: number },
  mode: 'get' | 'set',
  raw = 0
): Promise<DdcReply> {
  const script = SCRIPT.replace('__X__', String(point.x))
    .replace('__Y__', String(point.y))
    .replace('__MODE__', mode)
    .replace('__RAW__', String(raw))
  const out = await run(script)
  return JSON.parse(out.split(/\r?\n/).pop() ?? '{"supported":false}') as DdcReply
}

/** Centre of the target display in physical pixels, or null when there's no real (non-simulated) panel. */
function targetPoint(config: AppConfig): { x: number; y: number } | null {
  const target = resolveDisplayTarget(config, listDisplays())
  if (target.isSimulated || target.matchedDisplayId == null) return null
  const display = screen.getAllDisplays().find((d) => d.id === target.matchedDisplayId)
  if (!display) return null
  const r = screen.dipToScreenRect(null, display.bounds)
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
}

/**
 * Drives the panel's own backlight over DDC/CI, in addition to (not instead
 * of) the software dimmer. The monitor's original level is remembered when
 * the feature is first turned on and put back when it's turned off or the
 * app quits, so a forgotten "30%" doesn't stay burned into the monitor's OSD.
 */
export class BrightnessManager {
  private timer: NodeJS.Timeout | null = null
  private chain: Promise<void> = Promise.resolve()
  private original: { point: { x: number; y: number }; raw: number } | null = null
  private lastApplied = ''

  constructor(private getConfig: () => AppConfig) {}

  async probe(): Promise<BrightnessProbe> {
    if (process.platform !== 'win32') return { supported: false, error: 'Windows only' }
    const point = targetPoint(this.getConfig())
    if (!point)
      return { supported: false, error: 'Select a real display first (not the simulator)' }
    try {
      const r = await call(point, 'get')
      if (!r.supported || r.min == null || r.max == null || r.cur == null) {
        return {
          supported: false,
          error: 'This display doesn’t support brightness control (DDC/CI)'
        }
      }
      return { supported: true, percent: rawToPercent(r.cur, r.min, r.max) }
    } catch (err) {
      return { supported: false, error: (err as Error).message }
    }
  }

  /** Debounced, serialized: dragging the slider only ever sends the latest value. */
  apply(): void {
    if (process.platform !== 'win32') return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.chain = this.chain.then(() => this.applyNow()).catch(() => {})
    }, 400)
  }

  hasOriginal(): boolean {
    return this.original != null
  }

  /** Restores the original brightness (if we changed it). Await before quitting. */
  async restore(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    await this.chain
    const original = this.original
    if (!original) return
    this.original = null
    this.lastApplied = ''
    try {
      await call(original.point, 'set', original.raw)
    } catch {
      // monitor gone or script blocked: nothing more to do
    }
  }

  private async applyNow(): Promise<void> {
    const config = this.getConfig()
    const { enabled, level } = config.display.hardwareBrightness
    const point = targetPoint(config)

    if (!enabled || !point) {
      await this.restore()
      return
    }
    const key = `${point.x},${point.y},${level}`
    if (key === this.lastApplied) return

    const info = await call(point, 'get')
    if (!info.supported || info.min == null || info.max == null || info.cur == null) return
    if (!this.original) this.original = { point, raw: info.cur }
    await call(point, 'set', levelToRaw(level, info.min, info.max))
    this.lastApplied = key
  }
}
