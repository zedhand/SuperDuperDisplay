import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { screen } from 'electron'
import type { AppConfig } from '@shared/types'
import { resolveDisplayTarget } from './displayManager'
import { listDisplays } from './displays'

/**
 * Windows-only helper script: reads "x y w h" (physical pixels) lines from
 * stdin and "off" to disable. While a rect is set, it polls the cursor and
 * pushes it back out to the nearest edge if it enters the rect. Pushing back
 * (rather than ClipCursor) means games that call ClipCursor themselves can't
 * undo it, and it works with any monitor layout.
 */
const SCRIPT = `
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Threading;
public class CG {
  [StructLayout(LayoutKind.Sequential)] public struct PT { public int X; public int Y; }
  [DllImport("user32.dll")] static extern bool GetCursorPos(out PT p);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  public static volatile int L, T, R, B; public static volatile bool On;
  public static void Init() {
    SetProcessDpiAwarenessContext(new IntPtr(-4));
    Thread t = new Thread(Run); t.IsBackground = true; t.Start();
  }
  static void Run() {
    while (true) {
      Thread.Sleep(4);
      if (!On) continue;
      PT p; if (!GetCursorPos(out p)) continue;
      if (p.X < L || p.X >= R || p.Y < T || p.Y >= B) continue;
      int dl = p.X - L, dr = R - 1 - p.X, dt = p.Y - T, db = B - 1 - p.Y;
      int m = Math.Min(Math.Min(dl, dr), Math.Min(dt, db));
      int nx = p.X, ny = p.Y;
      if (m == dl) nx = L - 1; else if (m == dr) nx = R; else if (m == dt) ny = T - 1; else ny = B;
      SetCursorPos(nx, ny);
    }
  }
}
"@
[CG]::Init()
while (($line = [Console]::In.ReadLine()) -ne $null) {
  if ($line -eq 'off') { [CG]::On = $false; continue }
  $a = $line.Split(' ')
  if ($a.Length -eq 4) {
    [CG]::L = [int]$a[0]; [CG]::T = [int]$a[1]
    [CG]::R = [int]$a[0] + [int]$a[2]; [CG]::B = [int]$a[1] + [int]$a[3]
    [CG]::On = $true
  }
}
`

/** Keeps the mouse off the display-window's screen when config.display.lockMouse is on. */
export class CursorGuard {
  private proc: ChildProcessWithoutNullStreams | null = null

  constructor(private getConfig: () => AppConfig) {}

  /** Re-evaluates config + connected displays and (re)sends the blocked rect. Cheap; call after any change. */
  apply(): void {
    if (process.platform !== 'win32') return
    const config = this.getConfig()
    const target = resolveDisplayTarget(config, listDisplays())
    // Never lock out the simulated panel: it lives on a normal monitor.
    if (!config.display.lockMouse || target.isSimulated || target.matchedDisplayId == null) {
      this.send('off')
      return
    }
    const display = screen.getAllDisplays().find((d) => d.id === target.matchedDisplayId)
    if (!display) {
      this.send('off')
      return
    }
    const r = screen.dipToScreenRect(null, display.bounds)
    this.send(`${r.x} ${r.y} ${r.width} ${r.height}`)
  }

  stop(): void {
    this.proc?.kill()
    this.proc = null
  }

  private send(line: string): void {
    if (!this.proc) {
      if (line === 'off') return
      this.start()
    }
    this.proc?.stdin.write(line + '\n')
  }

  private start(): void {
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded],
      { windowsHide: true }
    )
    proc.on('exit', () => {
      if (this.proc === proc) this.proc = null
    })
    proc.on('error', (err) => console.error('[cursorGuard] failed to start:', err.message))
    proc.stdin.on('error', () => {})
    proc.stderr.on('data', (d) => console.error('[cursorGuard]', String(d)))
    this.proc = proc
  }
}
