import { execFile } from 'child_process'
import { promisify } from 'util'
import type { NowPlayingInfo } from '@shared/types'

const execFileAsync = promisify(execFile)

// Queries Windows' System Media Transport Controls (the same source Win+G's
// media widget and the volume flyout's "now playing" strip read) via the
// WinRT `GlobalSystemMediaTransportControlsSessionManager` API, projected
// into PowerShell the standard way (`System.Runtime.WindowsRuntime`'s
// `AsTask` extension reflected on, since PowerShell can't await a WinRT
// `IAsyncOperation` directly). Verified live before writing the Node side of
// this: a bare invocation of this exact script against a real playing tab
// returned real title/artist/status/appId in ~330ms.
const SMTC_SCRIPT = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$session = $mgr.GetCurrentSession()
if ($null -eq $session) {
    Write-Output '{"active":false}'
} else {
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
    $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $playback = $session.GetPlaybackInfo()
    $obj = [ordered]@{
        active = $true
        title = $props.Title
        artist = $props.Artist
        appId = $session.SourceAppUserModelId
        status = $playback.PlaybackStatus.ToString()
    }
    $obj | ConvertTo-Json -Compress
}
`.trim()

const INACTIVE: NowPlayingInfo = {
  active: false,
  title: null,
  artist: null,
  appId: null,
  status: 'unknown'
}

function encodeCommand(script: string): string {
  // -EncodedCommand takes base64 of UTF-16LE, PowerShell's own convention —
  // sidesteps every quoting/escaping concern of passing a multi-line script
  // as a single argument through execFile.
  return Buffer.from(script, 'utf16le').toString('base64')
}

function normalizeStatus(raw: string | undefined): NowPlayingInfo['status'] {
  switch (raw) {
    case 'Playing':
      return 'playing'
    case 'Paused':
      return 'paused'
    case 'Stopped':
      return 'stopped'
    default:
      return 'unknown'
  }
}

/**
 * Windows-only. Returns the inactive placeholder (never throws) on any other
 * platform, when nothing is playing anywhere, or on any failure reaching the
 * WinRT API — all expected/common cases, not worth logging on every poll.
 */
export async function getNowPlaying(): Promise<NowPlayingInfo> {
  if (process.platform !== 'win32') return INACTIVE
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encodeCommand(SMTC_SCRIPT)
      ],
      { timeout: 5000 }
    )
    const trimmed = stdout.trim()
    if (!trimmed) return INACTIVE
    const parsed = JSON.parse(trimmed) as {
      active: boolean
      title?: string
      artist?: string
      appId?: string
      status?: string
    }
    if (!parsed.active) return INACTIVE
    return {
      active: true,
      title: parsed.title || null,
      artist: parsed.artist || null,
      appId: parsed.appId || null,
      status: normalizeStatus(parsed.status)
    }
  } catch {
    return INACTIVE
  }
}

export class NowPlayingService {
  private timer: NodeJS.Timeout | null = null
  private readonly onTick: (info: NowPlayingInfo) => void

  constructor(onTick: (info: NowPlayingInfo) => void) {
    this.onTick = onTick
  }

  start(intervalMs = 2000): void {
    this.stop()
    const poll = (): void => {
      getNowPlaying().then(this.onTick)
    }
    poll()
    this.timer = setInterval(poll, intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
