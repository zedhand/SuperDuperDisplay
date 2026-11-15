import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { screen } from 'electron'
import type { AppConfig } from '@shared/types'
import { resolveDisplayTarget } from './displayManager'
import { listDisplays } from './displays'

/**
 * Windows-only helper script. Line protocol on stdin:
 *   rect X Y W H   physical-pixel rectangle of the panel
 *   dest X Y W H   physical-pixel work area to send stray windows to
 *   pid N          our own pid (our display window is never moved)
 *   mouse 0|1      keep the cursor out of the rect
 *   win 0|1        move other apps' windows out of the rect
 *
 * The cursor is pushed back out the side it entered from (rather than
 * using ClipCursor) so games that call ClipCursor themselves can't undo
 * it, and so any monitor layout works.
 */
const SCRIPT = `
Add-Type @"
using System; using System.Text; using System.Threading; using System.Runtime.InteropServices;
public class CG {
  [StructLayout(LayoutKind.Sequential)] public struct PT { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)] public struct RC { public int L, T, R, B; }
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out PT p);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RC r);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int w, int hh, uint f);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
  public static volatile int L, T, R, B, DX, DY, DW, DH, Pid;
  public static volatile bool Mouse, Win;
  public static void Init() {
    SetProcessDpiAwarenessContext(new IntPtr(-4));
    Thread m = new Thread(MouseLoop); m.IsBackground = true; m.Start();
    Thread w = new Thread(WinLoop); w.IsBackground = true; w.Start();
  }
  static void MouseLoop() {
    int lx = 0, ly = 0; bool have = false;
    while (true) {
      Thread.Sleep(4);
      if (!Mouse) { have = false; continue; }
      PT p; if (!GetCursorPos(out p)) continue;
      if (p.X < L || p.X >= R || p.Y < T || p.Y >= B) { lx = p.X; ly = p.Y; have = true; continue; }
      int nx = p.X, ny = p.Y;
      if (have) {
        // Push back out the side the cursor came in from; nearest-edge can pick the desktop's outer edge, which Windows clamps back inside.
        if (lx < L) nx = L - 1; else if (lx >= R) nx = R; else if (ly < T) ny = T - 1; else ny = B;
      } else {
        int dl = p.X - L, dr = R - 1 - p.X, dt = p.Y - T, db = B - 1 - p.Y;
        int m = Math.Min(Math.Min(dl, dr), Math.Min(dt, db));
        if (m == dl) nx = L - 1; else if (m == dr) nx = R; else if (m == dt) ny = T - 1; else ny = B;
      }
      SetCursorPos(nx, ny);
    }
  }
  static void WinLoop() {
    while (true) {
      Thread.Sleep(500);
      if (!Win || R <= L) continue;
      EnumWindows(delegate(IntPtr h, IntPtr l) { try { Check(h); } catch {} return true; }, IntPtr.Zero);
    }
  }
  static void Check(IntPtr h) {
    if (!IsWindowVisible(h) || IsIconic(h)) return;
    uint pid; GetWindowThreadProcessId(h, out pid);
    if (pid == (uint)Pid) return;
    if ((GetWindowLong(h, -20) & 0x80) != 0) return; // WS_EX_TOOLWINDOW
    int cloaked; if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return;
    StringBuilder sb = new StringBuilder(64); GetClassName(h, sb, 64);
    string c = sb.ToString();
    if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") return;
    RC r; if (!GetWindowRect(h, out r)) return;
    int w = r.R - r.L, hh = r.B - r.T;
    if (w <= 0 || hh <= 0) return;
    int cx = r.L + w / 2, cy = r.T + hh / 2;
    if (cx < L || cx >= R || cy < T || cy >= B) return;
    int nx = DX + Math.Max(0, (DW - w) / 2), ny = DY + Math.Max(0, (DH - hh) / 2);
    SetWindowPos(h, IntPtr.Zero, nx, ny, 0, 0, 0x0001 | 0x0004 | 0x0010); // NOSIZE | NOZORDER | NOACTIVATE
  }
}
"@
[CG]::Init()
while (($line = [Console]::In.ReadLine()) -ne $null) {
  $a = $line.Split(' ')
  switch ($a[0]) {
    'rect' { [CG]::L = [int]$a[1]; [CG]::T = [int]$a[2]; [CG]::R = [int]$a[1] + [int]$a[3]; [CG]::B = [int]$a[2] + [int]$a[4] }
    'dest' { [CG]::DX = [int]$a[1]; [CG]::DY = [int]$a[2]; [CG]::DW = [int]$a[3]; [CG]::DH = [int]$a[4] }
    'pid'  { [CG]::Pid = [int]$a[1] }
    'mouse' { [CG]::Mouse = ($a[1] -eq '1') }
    'win'   { [CG]::Win = ($a[1] -eq '1') }
  }
}
`

/** Keeps the mouse (and optionally stray windows) off the display window's screen. Driven entirely by config; call apply() after anything that could change it. */
export class CursorGuard {
  private proc: ChildProcessWithoutNullStreams | null = null
  private lastSent = ''

  constructor(private getConfig: () => AppConfig) {}

  /** Re-evaluates config + connected displays and (re)sends state to the helper. Cheap and idempotent. */
  apply(): void {
    if (process.platform !== 'win32') return
    const config = this.getConfig()
    const target = resolveDisplayTarget(config, listDisplays())
    // Never act on the simulated panel: it's just a window on a normal monitor.
    const display =
      target.isSimulated || target.matchedDisplayId == null
        ? undefined
        : screen.getAllDisplays().find((d) => d.id === target.matchedDisplayId)
    const mouse = !!display && config.display.lockMouse
    // Desktop mode means "treat the panel as a normal monitor", so windows may live there.
    const win =
      !!display &&
      config.display.keepWindowsOff &&
      config.display.mode !== 'hidden' &&
      display.id !== screen.getPrimaryDisplay().id

    if (!display || (!mouse && !win)) {
      this.send(['mouse 0', 'win 0'])
      return
    }
    const r = screen.dipToScreenRect(null, display.bounds)
    const primary = screen.getPrimaryDisplay()
    const d = screen.dipToScreenRect(null, primary.workArea)
    this.send([
      `rect ${r.x} ${r.y} ${r.width} ${r.height}`,
      `dest ${d.x} ${d.y} ${d.width} ${d.height}`,
      `pid ${process.pid}`,
      `mouse ${mouse ? 1 : 0}`,
      `win ${win ? 1 : 0}`
    ])
  }

  stop(): void {
    this.proc?.kill()
    this.proc = null
    this.lastSent = ''
  }

  private send(lines: string[]): void {
    const payload = lines.join('\n') + '\n'
    if (payload === this.lastSent && this.proc) return
    const off = lines.every((l) => l === 'mouse 0' || l === 'win 0')
    if (!this.proc) {
      if (off) return
      this.start()
    }
    this.lastSent = payload
    this.proc?.stdin.write(payload)
  }

  private start(): void {
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded],
      { windowsHide: true }
    )
    proc.on('exit', () => {
      if (this.proc === proc) {
        this.proc = null
        this.lastSent = ''
      }
    })
    proc.on('error', (err) => console.error('[cursorGuard] failed to start:', err.message))
    proc.stdin.on('error', () => {})
    proc.stderr.on('data', (d) => console.error('[cursorGuard]', String(d)))
    this.proc = proc
  }
}
