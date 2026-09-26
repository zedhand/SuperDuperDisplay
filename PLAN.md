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

## Status: Phase 4 (Automation and integration) — done and committed

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
    and drove a raw `ws` client through the full round trip —
    connected with the token, received the initial state push, sent
    `setMode: black`, and confirmed the server broadcast back
    `mode: "black"` (i.e. a remote client actually changed the running
    app's display mode, not just the UI's idea of it).

### Next up

- Phase 4 is functionally done — that's the "first test release"
  milestone. Before actually cutting a test release: smoke-test the
  Remote page's mobile page against a real phone on the same LAN (only
  a raw `ws` client and `curl` have exercised it so far, not the
  inline mobile HTML/JS itself in a real mobile browser), and decide
  if a release build (`npm run build:win`) is wanted yet or if more
  manual dogfooding on the real hardware comes first.

### Not yet started / explicitly deferred

- **Rebrand** — the user wants to fully rebrand the app (name, icon,
  app id — currently `com.electron.app` / "MiniDisplay" placeholder
  branding in `electron-builder.yml`) once the first test release is
  validated. Do not start this until told to.
- **UI overhaul** — a possible visual redesign of the control window,
  scoped only after seeing how the first test release actually feels
  to use. Do not start this speculatively.

## Known housekeeping items (low priority, not blocking)

- `README.md` at the repo root is the untouched electron-vite
  scaffold template and its first line is corrupted (a very long
  run of `y` characters, ~33KB on one line). Worth cleaning up before
  any public/rebrand push, not urgent otherwise.
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
