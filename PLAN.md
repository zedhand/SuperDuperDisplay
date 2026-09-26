# MiniDisplay — build plan

> **Read this file first when resuming work on this project**, before
> digging through `git log` or grepping the source for stubs. Update
> it whenever a feature lands, a phase closes, or the user makes a
> scope/priority call — not just at the end of a session.

## What this is

An Electron app that drives a case-mounted secondary display: a
control window (config UI, runs on the main monitor) and a display
window (fullscreen output, targeted at the secondary panel). Content
is arranged into resizable zones per layout, each zone showing one of:
local media, a media folder playlist, YouTube, a web page, live
hardware telemetry, or a camera feed (USB webcam or RTSP).

## Status: first real Windows release built and confirmed on real hardware

The real physical panel is connected: Windows sees it as display
**ZL480X1920** (1920×480, landscape, at `(2560, 0)`) alongside two
other monitors. `%APPDATA%/minidisplay/config.json` on this machine
now has `display.match` pointing at it (`simulate: false`) and
`activePresetId: "stats-only"` — i.e. this machine's install is
*actually driving the real hardware right now*, not simulating.

Built `dist/minidisplay-1.0.0-setup.exe` via `npm run build:win`,
installed it for real (`/S` silent install, to
`%LOCALAPPDATA%/Programs/minidisplay`), and verified against the
**installed production build**, not the dev server:
- Confirmed `MiniDisplay.exe` and `Uninstall MiniDisplay.exe` are
  named correctly (this is what the `electron-builder.yml` corruption
  fix actually gated).
- **Installer is not code-signed** (`Get-AuthenticodeSignature` →
  `NotSigned`). Windows SmartScreen will warn on first run for anyone
  who isn't the person who built it. Expected for now; a real cert is
  a separate future step if this ever leaves this machine.
- Since there's no desktop click-automation tool, verified the running
  windows directly via a small Win32 helper (`user32.dll`
  `EnumWindows`/`GetWindowRect`/`PrintWindow` through PowerShell
  `Add-Type`) rather than fighting window-occlusion/foreground-lock
  with a full-desktop screenshot. `PrintWindow` grabs a window's actual
  content regardless of z-order/occlusion — more reliable than
  `SetForegroundWindow`, which Windows silently no-ops for a
  non-foreground caller.
  **Update:** `PrintWindow` later turned out to be unreliable against
  this window specifically — it started returning solid black on some
  runs (a GPU-compositing/DirectComposition quirk, not a real
  rendering failure) and caused a false alarm chasing a phantom bug.
  **Launch the app with `--remote-debugging-port=9222` and use Chrome
  DevTools Protocol instead** (`Runtime.evaluate` to check real DOM
  content/values, `Page.captureScreenshot` for a trustworthy image) —
  it reads straight from Chromium's own compositor, not a native
  window capture API, so it doesn't have this failure mode.
- With `display.match` pointed at the real panel, captured the display
  window's content directly off that panel: confirmed correct blank
  (black) rendering on the default preset, then switched to the
  `stats-only` preset and confirmed **live telemetry actually rendering
  on the real hardware** (gauges showing real GPU temp/load/VRAM/RAM
  numbers, not a static/crashed frame).
- Left the app running post-verification — it's meant to run
  continuously, so there's no reason to kill it.

### Done

- **Phase 1 — Scaffold** (`2d5463d`): dual-window Electron app, display
  targeting/matching, simulate mode.
- **Phase 2 — Content zones + layout**:
  - Local media playback: `media://` protocol, seamless loop, fit
    modes (`3af940c`)
  - Folder-watched media playlists with shuffle + timed rotation
    (`bd09a43`)
  - YouTube and web-dashboard embed zones (`05add3e`)
  - Drag-to-resize layout editor (`e528a5f`)
- **Phase 3 — Telemetry + color**:
  - Hardware telemetry (LibreHardwareMonitor / nvidia-smi /
    systeminformation) + live stats zone (`3b7452f`)
  - Color correction pipeline: brightness/contrast/saturation/hue/gamma
    per color profile (`944387a`)
- **Phase 4 — Automation and integration** (all landed this session):
  - Thermal/load trigger engine — glow/preset-switch effects on
    metric thresholds (`5531d07`)
  - Windows power event sync: blank on lock/suspend/idle (`8f129a1`)
  - System tray, minimize-to-tray, launch-at-login (`d1f79d5`)
  - Camera zones: USB webcam via `getUserMedia`, RTSP via
    ffmpeg→MJPEG bridge (`fc921e5`)
  - **Scenes editor for stats/camera zones** (`cd87914`) — the Scenes
    page could render stats/camera zones but not configure them
    ("Editable in a later phase" stub). Built out: widget/style picker
    for stats, USB-device-dropdown/RTSP-URL editor for camera.
    `src/renderer/control/src/pages/Scenes.tsx`. *Verified live.*
  - **Settings page** (`d6c63dc`) — was a "Coming Soon" stub; backend
    already supported launch-at-login, start-minimized, telemetry
    source/URL/interval, and power-blanking config, just no UI.
    `src/renderer/control/src/pages/Settings.tsx`. *Verified live.*
  - **Remote control page** (`b38a2b5`) — LAN web remote with QR-code
    pairing,
    closing out the last "Coming Soon" stub. `RemoteServer`
    (`src/main/remote/server.ts`) runs an express + `ws` server gated
    by `config.remote.enabled`, serving a small inline mobile page
    (preset buttons + live/black/hidden mode buttons) over a
    token-authed WebSocket at `/ws`. Token auto-generates on first
    enable (`src/main/ipc.ts`'s `RemoteSetEnabled` handler), can be
    regenerated from the Remote page, and both the HTTP page load and
    the WS connection reject anything without the matching token
    (constant-time compare). QR code (`qrcode` pkg) encodes the LAN
    URL with the token baked in. *Verified live end-to-end*: curl'd
    the HTTP auth paths (403 on missing/wrong token, 200 on correct),
    drove a raw `ws` client through the full round trip (connected
    with the token, received the initial state push, sent
    `setMode: black`, confirmed the server broadcast back
    `mode: "black"`), and finally **smoke-tested from the user's actual
    phone on the real home Wi-Fi against the installed release build**
    — scanned the QR code, switched presets from the phone, confirmed
    on the real panel. (`1d5d901` fixed `getLanAddress()` first: it was
    picking a Tailscale IP over the real Ethernet adapter, which the
    phone couldn't have reached at all.)
  - **Dogfooding feedback on the stats zone, acted on immediately**
    (`237dcc7`, `2fc6ccf`, `0b6b28b`): with the panel actually mounted
    and visible, the user reported the stats text/gauges were too
    small and CPU Clock/GPU Clock were missing. Two real fixes, plus
    one bug found while verifying them:
    - `StatsZone.tsx` was sized entirely in fixed pixels (72px gauges,
      14px text) with no regard for the panel's actual physical size —
      switched to CSS container queries (`container-type: size` on the
      zone root, `cqmin`-based `clamp()` everywhere else) so it scales
      to whatever box it's actually given.
    - The default `stats-only` preset was missing `cpuClockMHz` /
      `gpuClockMHz` even though both were already-defined metrics —
      added them (8 widgets total now).
    - **CPU Temp reads `—`**: not a bug — confirmed live
      (`curl localhost:8085` refused, not in the process list) that
      LibreHardwareMonitor, the only source `lhm.ts` has for CPU temp,
      isn't installed/running on this machine. Flagged to the user,
      not fixed (installing third-party software needs their say-so).
    - While rebuilding to verify the sizing fix, a native
      `PrintWindow`-based screenshot came back solid black on the
      *production* build specifically. Chasing it with Chrome DevTools
      Protocol (see the verification-methodology note above) found the
      real bug: `Stage.tsx` only ever subscribed to the
      config-changed *push* channel; the main process sends the
      initial config exactly once, on that window's own
      `did-finish-load`, with no retry if the renderer's `useEffect`
      hadn't registered its listener yet. A bigger production bundle
      taking longer to parse than dev's unbundled ESM modules made
      that race losable in practice — the window would render nothing
      until some unrelated config change happened to broadcast again.
      Fixed by having the display window actively fetch the current
      config on mount (`window.display.getConfig()`, new), matching
      what the control window's config store already did for
      `window.control.config`. This was a latent bug since Phase 1,
      unrelated to the stats changes that led to finding it.
  - **LibreHardwareMonitor installed and configured for CPU Temp**:
    downloaded v0.9.6 from the official GitHub releases, extracted to
    `C:\Tools\LibreHardwareMonitor` (portable, no installer). Its
    settings are a plain XML file next to the exe
    (`LibreHardwareMonitor.config`, key/value `appSettings` — found by
    reading its `PersistentSettings.cs`/`UserOption.cs`/`MainForm.cs`
    source directly, not guessed), pre-seeded *before first launch* so
    it came up with the Remote Web Server already enabled on `:8085`
    (MiniDisplay's default `telemetry.lhmUrl` already pointed here — no
    port mismatch) rather than needing anyone to click through its
    Options menu. Registered as a Scheduled Task (`schtasks`, logon
    trigger, `RL HIGHEST`) rather than the Windows "Run" registry key,
    matching exactly what LHM's own "start on Windows startup" checkbox
    does internally (`StartupManager.cs`) — this way it launches
    elevated automatically every login with no UAC prompt, since admin
    rights are required to read most sensors. Verified end to end: the
    real motherboard is an AMD system (Gigabyte X570 AORUS ELITE);
    confirmed its `Core (Tctl/Tdie)` sensor (`/amdcpu/0/temperature/2`)
    is exactly what `parsers.ts`'s existing AMD-label matching already
    expected, then confirmed via CDP that MiniDisplay's CPU Temp gauge
    actually updated (51°C) — no code changes needed on the MiniDisplay
    side, this was purely an environment/setup gap.

### Next up

The "first test release" milestone is fully reached: a real
signed-less Windows build is installed on this machine, confirmed
driving the real ZL480X1920 panel with live content, **and** the
Remote page has been smoke-tested from an actual phone on the real
home Wi-Fi — user confirmed preset switching worked. Along the way,
found and fixed a real bug (`getLanAddress()` was picking a Tailscale
IP over the real Ethernet adapter — see the Remote control entry
above) and rebuilt/reinstalled before testing, so the fix is in the
binary that was actually tested, not just the source.

What's still open:

- **Firewall rule is broader than intended.** The inbound Allow rule
  for `MiniDisplay.exe` covers both Private and Public network
  profiles; the user asked for Private-only, but narrowing it needs
  an elevated (UAC) `Set-NetFirewallRule`, and that elevation prompt
  can't be clicked non-interactively. Left as Private+Public — low
  practical risk on a home setup, but a 10-second manual fix if it
  matters: Windows Defender Firewall → Advanced Settings → the two
  inbound "minidisplay.exe" rules → uncheck Public.
- **Dogfood it for real** — this machine is now actually configured to
  drive the physical panel (see Status above). Use it for a while
  before deciding rebrand/UI overhaul scope; some of that scope may
  become obvious from actually living with it.
- Decide when to move on to **rebrand** and/or **UI overhaul** (see
  below) — the user said these wait until after this milestone, which
  just landed, so this is now a real decision point, not a deferred one.

### Not yet started / explicitly deferred

- **Rebrand** — the user wants to fully rebrand the app (name, icon,
  app id — currently `com.electron.app` / "MiniDisplay" placeholder
  branding in `electron-builder.yml`) once the first test release is
  validated. Do not start this until told to.
- **UI overhaul** — a possible visual redesign of the control window,
  scoped only after seeing how the first test release actually feels
  to use. Do not start this speculatively.

## Known housekeeping items (low priority, not blocking)

- ~~`README.md` was the untouched electron-vite scaffold template with
  a corrupted first line~~ — rewritten to actually describe the app
  (features, dev setup) and matches this user's usual README structure
  (tagline, beta banner, feature bullets, "For developers" section).
- **`electron-builder.yml` has the same corruption**: `productName`
  and `win.executableName` are each a ~33KB single line of repeated
  `y` characters instead of a real value. Unlike the README this is a
  functional bug, not cosmetic — it'll affect what a real
  `build:win`/`build:mac`/`build:linux` actually produces (installer
  shortcut name, uninstall display name, the `.exe` name itself).
  Flagged to the user; not fixed yet since it overlaps with the
  planned rebrand (new name/icon/appId) and picking a placeholder now
  would just be thrown away then. Fix this **before the first real
  build**, whether that's as part of the rebrand or before it.
- No config.json existed in `%APPDATA%/minidisplay` until this
  session's live-testing runs created one with plain defaults
  (`activePresetId: full-bleed-loop`) — that's real first-run state,
  not test residue.
- `npm install` reports 2 high-severity advisories (`extract-zip`, a
  transitive dep of `electron` itself) — pre-existing, unrelated to
  anything built this session, fixed only by a breaking Electron
  version bump. Not addressed; flag before a real release.
- On this machine, `python -c "...open('/c/posix/path')..."` fails
  with `FileNotFoundError` even when the file exists — Git Bash only
  auto-translates a bare POSIX-path argument for a native exe, not one
  embedded inside a larger quoted string. Pipe file content in instead
  (`cat file | python -c "...sys.stdin..."`) rather than opening a
  POSIX path from inside a Python string.

## How verification is done here (no desktop GUI automation available)

There's no Windows desktop click-automation tool available in this
environment (Chrome browser automation exists but doesn't reach native
Electron windows). The working pattern for visually verifying
control-window changes:

1. Temporarily set `App.tsx`'s default `useState<PageId>(...)` to the
   page under test.
2. Temporarily add a `did-finish-load` capture for `controlWin` next to
   the existing `MINIDISPLAY_AUTO_CAPTURE` block in `src/main/index.ts`
   (which already auto-captures `displayWin` after 1.5s in dev mode) —
   `captureDisplayWindow()` in `src/main/ipc.ts` works on any
   `BrowserWindow`.
3. If the page needs specific config state (e.g. a zone already set to
   a given type), seed `%APPDATA%/minidisplay/config.json` directly
   with a full valid `AppConfig` (matches `src/shared/schema.ts`'s
   `appConfigSchema` — check real layout/preset IDs in
   `defaultConfig`, don't guess them).
4. Run `MSYS_NO_PATHCONV=1 MINIDISPLAY_AUTO_CAPTURE=1 npm run dev`,
   read the `[debug] control capture: <path>` line from stdout, and
   `Read` the PNG.
5. **Always revert** the two temporary edits and remove any seeded
   `config.json` / capture PNGs afterward — check `git status --short`
   comes back to only the intended feature diff before finishing.
