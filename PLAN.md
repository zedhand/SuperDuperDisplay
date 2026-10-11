# SuperDuperDisplay (formerly MiniDisplay) — build plan

> **Renamed in Session 11.** Everything below written before that session
> refers to the app as "MiniDisplay" — left as-is since it's an accurate
> historical record of what happened when it happened, not rewritten for
> the new name. See the Session 11 entry for exactly what the rename
> touched (and deliberately didn't).

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
_actually driving the real hardware right now_, not simulating.

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
    `src/renderer/control/src/pages/Scenes.tsx`. _Verified live._
  - **Settings page** (`d6c63dc`) — was a "Coming Soon" stub; backend
    already supported launch-at-login, start-minimized, telemetry
    source/URL/interval, and power-blanking config, just no UI.
    `src/renderer/control/src/pages/Settings.tsx`. _Verified live._
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
    URL with the token baked in. _Verified live end-to-end_: curl'd
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
      _production_ build specifically. Chasing it with Chrome DevTools
      Protocol (see the verification-methodology note above) found the
      real bug: `Stage.tsx` only ever subscribed to the
      config-changed _push_ channel; the main process sends the
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
    source directly, not guessed), pre-seeded _before first launch_ so
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
  - **Second round of dogfooding feedback** (`62b630a`): with all 8
    widgets visible and readable, the user wanted them grouped by what
    they measure (CPU together, GPU together, memory together —
    they'd been interleaved) and significantly bigger. Reordered
    `METRICS` and both default presets' widget lists to group by
    category, and roughly doubled every size in `StatsZone.tsx` (the
    first sizing pass left a lot of headroom unused in the `clamp()`
    ranges). Verified via CDP on the real installed build: widgets now
    render in CPU → GPU → memory order, and gauges went from ~96px to
    ~216px at this panel's actual 1920×480 while still comfortably
    fitting one row with margin to spare.
  - **Third round: the fixed-size approach broke down on a narrower
    zone** (`c70a0f2`, `6135625`, `a6d5d14`). The 70/30 preset's 30%-
    width column (real screenshots from the user) showed the exact
    failure mode `clamp(cqh)`-based sizing can't avoid: bars overflowed
    top and bottom with only a few widgets in a narrow column, labels
    wrapped mid-word ("CPU"/"Temp" on separate lines), and unbreakable
    value strings ("3800MHz") got clipped straight past the window
    edge — all confirmed on the real panel, not just reasoned about.
    Rebuilt `StatsZone.tsx` around one general mechanism instead of
    more fixed clamp tuning: a `ResizeObserver` measures the zone's
    actual rendered pixel size, and `pickColumns()` tries every
    possible column count for the current widget count and keeps
    whichever one lets a cell grow largest without overflowing either
    axis, given that style's natural cell shape (gauges ~square,
    bars/compact wide-short). Each row became its own nested
    container-query context sized from _that cell_, and — the second
    fix within this pass — bars/compact font-size had to respect both
    `cqh` and `cqw` (`min()` of the two), not just height, since a
    label+value pair is unbreakable text that can overflow a narrow
    column's width even at a height that "fits". Verified via CDP
    against the real installed build on both zone shapes: the 30%
    column (6-8 widgets, bars and gauges) and the full-bleed zone
    (8 widgets, bars) — no overflow, no wrapping, no clipping in
    either case.
  - **Fourth round: the auto-scaling grid was right, the row layout
    itself wasn't** (`8c36eb7`). Bars/compact used a single
    "label ... value" line with `justify-content: space-between`,
    which put the value right up against the _next_ column's label
    with no breathing room — read as crowded/misaligned even with a
    correctly-sized grid underneath. Compact was worse: when its
    font-size estimate didn't quite fit, the label wrapped onto two
    lines with nothing clipping it, so it visually overlapped the
    row above/below — genuinely scattered text, not just a style
    complaint. Redesigned both as left-aligned stacked tiles (label
    small/muted above, value large/bold below, bar under that for
    bars), and added `whiteSpace:nowrap` + `overflow:hidden` +
    `textOverflow:ellipsis` to every label/value as a hard backstop —
    no font-size estimate is ever perfect, so worst case now is a
    clean "…" truncation instead of wrapping into a neighbor. Verified
    all four combinations (bars/compact × narrow 30% zone/full-bleed
    zone) via CDP screenshot on the real installed build.

### Broader dogfooding pass — non-stats zones and control pages

With the stats zone settled, proactively exercised the parts of the
app nobody had actually looked at on real hardware yet, using the
same CDP-screenshot loop against the real installed build:

- **Media zone** (`cover` and `contain`+blur fit modes) — correct,
  no changes needed.
- **Folder playlist** — confirmed it actually rotates on its own
  timer (screenshotted twice, image changed).
- **Web zone** — correct, a real external site rendered via the
  `<webview>`.
- **Camera zone** — correct; happens to be a real Elgato capture
  device on this machine, showed its live "no signal" idle frame
  (nothing plugged into its HDMI in — expected, not a MiniDisplay
  bug).
- **Layout editor page — found and fixed a real bug** (`132639b`):
  layouts are shared by id across presets (the default `single`
  layout backs both "Full-bleed loop" and "Black"), but `Layout.tsx`
  mutated the active preset's layout in place with no awareness of
  that sharing. Triggered it directly while testing: clicking "Split
  left / right" to preview a split silently turned the shared
  `single` layout into a 70/30 split, which also — completely
  incidentally — cut the unrelated active camera zone down to 70% of
  the screen. That's what got reported as the camera's "aspect ratio"
  being wrong; the video's own pixel aspect ratio was never actually
  distorted (`object-fit: cover` was working correctly throughout),
  the zone it was rendering into had just been resized out from under
  it via a completely different page. Fixed with clone-on-write: the
  page now clones the layout (new id, distinguishing name) and
  repoints only the active preset at the clone the moment it detects
  another preset sharing the same layout id, so editing a layout can
  now only ever affect the preset being looked at. Verified the fix
  directly: repeated the exact same click, confirmed `single` stayed
  `split:"single"` and only `full-bleed-loop` got repointed to a new
  clone.
- **YouTube zone — real bug found, partially fixed, real residual
  limitation documented** (`732da17`): the embed iframe was served
  with no Referer header at all, which YouTube's player rejects
  outright (error 153) before attempting playback. Added the
  standards-documented fix — a `session.webRequest` handler forcing
  `Referer: https://www.youtube.com/` on embed requests, plus a
  matching `origin=` param on the embed URL (the player checks both
  together). This does move past error 153, but real testing (in this
  file://-origin production build, _and_ in dev mode over
  `http://localhost` specifically to rule out file:// itself as the
  cause) hits a further error 152-4 ("video unavailable") regardless.
  Researched rather than kept guessing at header combinations: found
  a matching, still-open GitHub issue for the identical error in a
  native iOS WebView, where header-patching alone didn't fix it
  either — this looks like YouTube's anti-embedding fingerprinting
  rejecting non-browser Chromium contexts at a level below what
  request headers can influence. The one documented working
  workaround is serving the embedding page itself from a real
  registered http(s) domain (e.g. via a proxy) rather than
  file:///localhost, which is a materially bigger architecture change
  than a header fix. **YouTube zone should currently be considered
  broken/unreliable** — kept the Referer/origin fix since it's still
  correct per YouTube's own API docs, but did not chase this further.
- RTSP camera path not tested this round (no RTSP camera available on
  this network) — code-reviewed only.

### YouTube — session 2, asked to "figure it out": still unresolved

User asked to actually fix YouTube (not just document the limitation).
Found and ruled out two more real hypotheses before running low on
context — this needs to resume from here, not from scratch:

- **`navigator.userAgent` literally contains `Electron/39.8.10`**
  (full string logged via CDP:
  `...minidisplay/1.0.0 Chrome/142.0.7444.265 Electron/39.8.10
Safari/537.36`) — a textbook anti-bot red flag. Tested overriding
  it to a clean desktop Chrome UA (no Electron/app name) via CDP
  `Network.setUserAgentOverride`, combined with the existing
  Referer/origin fix. **Still error 152-4.** Ruled out: UA string
  alone is not the (sole) blocker.
- **Hypothesis: CDP itself was the confound.** Nearly every YouTube
  test this whole investigation (both sessions) was driven through
  `--remote-debugging-port` + active CDP commands — which can set
  `navigator.webdriver = true` and other automation flags that
  anti-bot detection specifically looks for, meaning every prior
  152-4 result might have been an artifact of _how it was tested_,
  not real end-user behavior. Tested this directly: launched with
  **no debug port at all**, waited for a real, undriven page load,
  and read the result via a native `PrintWindow` screenshot (zero CDP
  involvement, same technique used elsewhere in this file to verify
  the production build without disturbing it). **Still error 152-4,
  identical failure.** Ruled out: this is not a CDP/automation-
  detection artifact — it fails the same way for a completely normal,
  undebugged launch.

**Where this leaves it:** two independent, high-probability hypotheses
have both been directly tested and ruled out (not just reasoned
about) on top of the Referer/origin fix already in place. What's left
untested: the actual documented working workaround (serve the embed
page from a real http(s) origin via a proxy/local server — note this
is _not_ the same as "any non-file:// origin", since dev mode's
`http://localhost:5173` was already tried this session too and still
failed 152-4, so a bare local server likely won't be enough either;
the workaround specifically implies a real, publicly-routable domain).
That's a genuinely bigger architecture change, not a quick fix, and
hasn't been attempted. **Next session: either scope and build that
proxy approach if it's worth the investment, or tell the user
directly that YouTube embedding is very likely not fixable within
Electron's constraints without it, rather than continuing to
hypothesize.**

Housekeeping for next session: the live config on this machine
currently has `full-bleed-loop`'s zone0 set to the YouTube zone
(broken, mid-test) and `activePresetId: full-bleed-loop` — not a
deliberate end state, just where testing stopped. Worth resetting to
something sensible (e.g. back to `stats-only`) before/instead of
further YouTube work.

### Session 3: broad video-format support + YouTube actually fixed + desktop-mode clarity

User asked to (1) fix YouTube for real, and (2) support many more media
formats (MKVs specifically didn't work). Both landed and were verified
live — not just reasoned about — without disturbing the live production
instance (see the verification-methodology note below; the installed
build was running throughout and its single-instance lock was
deliberately respected, never killed).

- **Broad video-format support via on-demand ffmpeg normalize**
  (new `src/main/media/transcode.ts`): confirmed live, via a throwaway
  Electron probe checking `video.canPlayType()`, that this Chromium
  build plays `mp4`/`webm` natively but returns `""` (completely
  unsupported) for `mkv`/`avi`/`mov`/`wmv`/`mpeg`-style containers
  regardless of the codec inside — Chromium simply has no demuxer for
  those containers, so no header/config fix could ever have worked.
  `shared/media.ts` now recognizes a much wider set of video extensions
  (`mkv`, `avi`, `mov`, `wmv`, `flv`, `mpg`, `mpeg`, `m4v`, `ts`,
  `m2ts`, `mts`, `3gp`, `3g2`, `ogv`, `vob`, `asf`, `m2v`, `divx`) and a
  few more native image formats (`bmp`, `ico`, `avif`, `svg` — verified
  live via a probe loading each through the actual `media://` protocol
  handler; `tiff` deliberately excluded, Chromium has never supported
  it). `protocol.ts`'s `media://` handler now transparently swaps an
  unsupported-container request for a cached, normalized `.mp4` before
  serving it — the renderer/FolderMediaZone/MediaZone code never
  changed, since both already go through `toMediaUrl()` →
  `media://file?p=...`.
  - **Real bug found and fixed during verification, not assumed away**:
    the first version trusted "`ffmpeg -c copy` exits 0" as proof the
    remux was safe to serve. It isn't — ffmpeg will happily remux a
    `mpeg2video`/`mp2` stream into an `.mp4` container (a valid file by
    ffmpeg's own standard) that Chromium still flatly refuses to play
    (`MEDIA_ELEMENT_ERROR`, confirmed live via a probe loading the
    output through the real `media://` scheme). Fixed by probing the
    source's actual codec names first (parsed straight from ffmpeg's
    own stream-info stderr — no `ffprobe` binary is bundled) against an
    allowlist of codecs Chromium can actually decode
    (h264/hevc/vp8/vp9/av1 video; aac/mp3/opus/vorbis/flac/pcm audio),
    and only remuxing (`-c copy`, near-instant) when both streams
    already qualify — anything else goes through a real transcode to
    h264/aac. Verified both paths end-to-end with synthetic test files
    (h264+aac → fast remux, plays; mpeg2+mp2 → real transcode, plays).
  - Cached under `userData/mediaCache`, keyed by a hash of the source
    path+size+mtime so editing/replacing a source file invalidates its
    cache entry automatically; concurrent requests for the same file
    share one ffmpeg run. No cache eviction yet — fine for a personal
    media library, but unbounded over time; a known follow-up if it
    ever matters (see Known housekeeping items).
  - Also widened the file-picker dialog filter (`ipc.ts`) and folder-
    playlist watcher (`folderSync.ts`, which had its own separately
    hand-maintained extension list — now imports the shared one instead
    of duplicating it) to match.
- **YouTube — actually fixed, not just re-documented.** Session 2 had
  ruled out UA spoofing and CDP-as-confound, concluding the only
  documented working fix was serving the embed's parent page from a
  real public https origin — asked the user, who approved creating a
  small new public repo for this. Built it:
  - New tiny static page, source at
    `github.com/zedhand/minidisplay-yt-embed`, hosted on GitHub Pages
    at `https://zedhand.github.io/minidisplay-yt-embed/`. Takes
    `?v=<videoId>`, embeds a chromeless/autoplay/muted/looped
    `youtube-nocookie.com` iframe, and crops it to "cover" its own
    viewport at 16:9 (ported from `YoutubeZone.tsx`'s old
    `useCoverSize` hook, since this page is now the one that actually
    knows its own on-screen size). No backend, no analytics, no state.
  - `YoutubeZone.tsx` simplified to a single `<webview>` pointed at that
    relay URL instead of an `<iframe>` embedding YouTube directly from
    this app's own file:// document — a webview's guest page is a
    genuinely separate top-level browsing context, so YouTube's player
    sees the relay's real https origin as `document.referrer`, not
    this app's origin. Removed the now-obsolete (and, worse, now
    actively wrong) `registerYoutubeEmbedReferer()` Referer-spoofing
    hook from `webSecurity.ts` — forcing a fake `Referer` no longer
    makes sense once a real, correct one exists naturally.
  - **Verified live, end to end, three separate times**, matching
    production's exact `webPreferences`
    (`contextIsolation`/`sandbox`/`webviewTag` from
    `windows/displayWindow.ts`, plus the app-wide
    `registerWebviewHardening()` handler) rather than a bare probe:
    (1) a real YouTube video (Big Buck Bunny, CC-licensed) actually
    played — screenshotted twice, 6s apart, showing the frame
    progressing, not a static thumbnail before an error; (2) the cover-
    crop math correctly fills a 1920×480 panel-shaped window (full
    width, cropped top/bottom); (3) same at a narrow 300×480 window
    (full height, cropped sides).
  - **Real bug found and fixed during this verification**: the cover-
    crop `resize()` read `window.innerWidth`/`innerHeight` as `0`
    during the page's own synchronous initial-script run (before
    layout had settled), silently no-op'd on its zero-guard, and — since
    a webview guest's viewport is already at its final size from
    creation — no later `resize` DOM event ever fired to correct it,
    leaving the iframe stuck at its unstyled ~300×150 default. Fixed by
    also re-running `resize()` on `'load'` and via
    `requestAnimationFrame`. (A second apparent failure after that fix
    turned out to be GitHub Pages' `Cache-Control: max-age=600` serving
    a stale pre-fix response back to the same test session — not a
    real bug; resolved by clearing the session cache between test runs.
    Not a concern in normal use.)
  - This does mean YouTube zones now depend on this app's machine
    having internet access to reach both `zedhand.github.io` and
    YouTube itself — same as before, just now also the relay page.
- **"Desktop mode" already existed, just wasn't labeled as one.** User
  asked for "a full normal desktop mode... like when the app isn't
  running." Investigated first rather than building a duplicate: the
  existing `hidden` display mode already does exactly this
  (`displayManager.ts`'s `applyMode()` just calls `win.hide()`, and the
  window is already `ignoreMouseEvents`/`focusable: false`, so a hidden
  window leaves the real Windows desktop fully interactive underneath —
  confirmed this composes correctly with power-blanking too, since
  `PowerManager` already saves/restores whatever mode was active
  before a lock/suspend/idle blank, `hidden` included). The gap was
  purely discoverability: both the Displays page and the Remote page's
  mode buttons just capitalized the raw enum value (`"Hidden"`), with
  no explanation. Fixed by relabeling the button to **"Desktop"** in
  both places and adding a one-line description under the mode picker
  on the Displays page explaining what it does. Deliberately did not
  rename the underlying `hidden` config value — only the UI label
  changed, so no config migration needed.
- **Rebuilt, reinstalled, and re-verified against the real installed
  app later this same session — and this is exactly what caught two
  real, severe, production-only bugs that every isolated probe had
  missed.** See the next section.

**Verification methodology note, worth keeping for next time**: the
installed production build was running for the entire session (per its
own single-instance lock, confirmed by `npm run dev` silently
exiting — `app.requestSingleInstanceLock()` failing quits immediately
with no error logged, which is exactly what happened on the first
attempt to launch a dev instance for testing). Rather than killing a
process that's meant to run continuously and is actively driving real
hardware, every verification this session was done via small, disposable
Electron/Node scripts in the scratch directory that don't touch the
live app's userData/lock at all — registering the same `media://`
privileged scheme, the same webview-hardening handler, and the same
`webPreferences` the real app uses, but in a throwaway process. This is
a more surgical alternative to the file's existing "temporarily edit
`App.tsx`/seed `config.json`/run dev" recipe for cases where dev mode
literally cannot start.

### Session 3 continued: per-zone volume control, aspect-fit button, preset rename — and two severe bugs the rebuild caught that dev-mode never could

User asked for three more things in quick succession: (1) per-zone
volume control, defaulting to muted (triggered by discovering the Web
zone has no muting at all — pointing it straight at a youtube.com URL
played real, loud ad audio, "ear bombed by youtube ads"); (2) renaming
the "70/30 media + stats" preset to something clearer; (3) a button to
auto-scale a zone's aspect ratio to whatever its content needs.

- **Web zone had no muting at all** (`WebZone.tsx`) — unlike every
  other zone type, which were already always-muted by design. Fixed by
  calling the webview's `setAudioMuted()` on `dom-ready` (a `<webview>`
  has no `muted` HTML attribute or fractional volume, just that one
  boolean).
- **Per-zone `volume` (0-1, defaults to 0) added to media/youtube/web
  zone schemas** (`shared/schema.ts`, `shared/types.ts`), wired all the
  way through:
  - `MediaZone.tsx`: `el.volume`/`el.muted` set imperatively on both
    of its two loop-buffer `<video>` slots (never on the decorative
    blurred backdrop copy, which must always stay silent regardless —
    otherwise a `bg: 'blur'` zone would double up the same audio).
  - `WebZone.tsx`: `setAudioMuted(volume <= 0)` — binary only, a
    webview has no fractional volume API, documented in both the code
    and the Scenes editor (a mute/unmute checkbox there, not a
    misleading slider).
  - YouTube: real fractional volume, not just mute — upgraded
    `minidisplay-yt-embed`'s relay page to use the YouTube IFrame
    Player's postMessage protocol directly (`enablejsapi=1`,
    `setVolume`/`mute`/`unMute` commands), exposing
    `window.__setVolume(0-100)` for the host to call live via
    `webview.executeJavaScript()` — changing the volume slider never
    reloads (and so never restarts) the video. Confirmed live first
    that this Electron build's autoplay policy allows _unmuted_
    autoplay with no user gesture at all (`playerState` reached
    `1`/playing with `mute=0` and zero interaction), so there's no
    "start muted, unmute after a click" workaround needed.
  - Scenes editor got a `VolumeSlider` (0-100%, or a mute/unmute
    checkbox for the Web zone) under each affected zone type.
- **Preset renamed**: `media-plus-stats`'s default name is now "Split
  Zones" (`schema.ts`), and the live config on this machine was
  patched to match via the real `config:set` IPC path, not a raw file
  edit — there's still no general "rename any preset" UI, this was a
  one-off content fix for the one preset asked about.
- **Aspect-ratio auto-fit button** ("Fit to content" in Scenes, next
  to the fit-mode buttons, media zones only, non-folder): resizes the
  layout's `h`/`v` split so the zone's box exactly matches its video/
  image's real pixel aspect ratio, no cropping regardless of `fit`
  mode. New pieces: `shared/layout.ts`'s `computeAutoFitSizes()` (pure
  math: solves for the fraction that makes one zone's box match a
  target aspect at the panel's actual content size, redistributing the
  rest proportionally — generalizes past the common 2-zone case) and
  `updateLayoutForPreset()` (the existing Layout-page clone-on-write
  logic, extracted so this button can reuse it correctly rather than
  risking the exact cross-preset-mutation bug `132639b` already fixed
  once); a new `zone:getNaturalSize` IPC round-trip
  (`preload/control.ts` → `main/ipc.ts` → `displayWin.webContents
.executeJavaScript()`) so the control window — which never renders
  actual media itself — can ask the display window for a zone's live
  `videoWidth/videoHeight`/`naturalWidth/naturalHeight`; and a
  `data-zone-id` attribute on each zone's wrapper in `Stage.tsx` for
  that query to target. Verified live: `getNaturalSize('zone0')`
  correctly returned `{width:320,height:240}` for the test video
  actually loaded there. The Scenes-page button click-through itself
  (not just its building blocks) wasn't separately verified — doing so
  needs the Scenes page to be the control window's active view, which
  needs the "temporarily edit `App.tsx`'s default page" recipe this
  file documents, not attempted this round given everything else
  already in flight.

**Rebuilding and reinstalling to verify all of the above against the
real installed app — not just isolated dev-mode probes — caught two
severe, real, production-only bugs. This is exactly the scenario the
"verify against the real build, not just dev mode" discipline in this
file exists for:**

1. **MKV/video-format support was completely broken in the actual
   installed app**, despite passing every single isolated-probe test
   run via plain `electron script.js` earlier this session. Root
   cause: `ffmpeg-static`'s own `index.js` computes its binary path as
   `path.join(__dirname, 'ffmpeg.exe')`, and `__dirname` for a module
   loaded from inside `app.asar` resolves to a path _inside_ that
   virtual archive — even though electron-builder physically unpacks
   the real `ffmpeg.exe` to `app.asar.unpacked` right alongside it.
   `child_process.spawn()` executes a real OS path, not Electron's
   virtual asar filesystem, so spawning the raw computed path silently
   fails in the packaged app while working perfectly in dev (no asar
   at all there). Confirmed directly: querying the actual `<video>`
   element in the real installed app showed `readyState: 0` forever
   (never loading) after setting a zone to a real MKV file — plain
   `.play()`/network inspection wasn't enough, had to trace it back to
   the spawn call itself. Almost certainly means the RTSP camera
   bridge (`camera/rtsp.ts`) has had this exact same latent bug since
   Phase 4 — it was flagged in the dogfooding pass as "not tested this
   round (no RTSP camera available)" and never actually verified live
   in a packaged build, only code-reviewed. Fixed both call sites with
   one new shared helper, `main/media/ffmpegPath.ts`, which rewrites
   `app.asar` → `app.asar.unpacked` in the computed path (the standard,
   documented fix for this well-known ffmpeg-static + electron-builder
   interaction; a no-op in dev, where that string never appears).
   Verified live after the fix: the same test MKV went from
   `readyState: 0`/`paused: true` forever to actually decoding and
   playing (`readyState: 4`, `currentTime` advancing) in the real
   installed app.
2. **Calling a `<webview>`'s imperative APIs
   (`executeJavaScript()`/`setAudioMuted()`) before its own
   `dom-ready` event fires throws _synchronously_ — not a rejected
   promise, an actual uncaught exception — which crashed the entire
   display renderer to a blank black screen with no error visible
   anywhere in the UI.** Both `YoutubeZone.tsx` and `WebZone.tsx`'s new
   live-volume-update effects called these APIs unconditionally on
   mount, before the webview had necessarily finished attaching.
   Confirmed live: switching a zone to `web`/`youtube` type reliably
   blanked the whole display (`<div id="root"></div>`, nothing inside)
   until this was found via `Page.reload()` + a fresh
   `Runtime.exceptionThrown` listener, which caught the exact error —
   `"The WebView must be attached to the DOM and the dom-ready event
emitted before this method can be called."` Fixed in both files
   with the same pattern: a `readyRef` flag set `true` only inside the
   existing `dom-ready` listener, gating every later imperative call;
   the `dom-ready` handler itself applies whatever the latest prop
   value is at that point (via a ref kept in sync through its own
   effect, not written during render — that's also disallowed by this
   project's lint rules), so nothing gets silently dropped, it's just
   deferred until it's actually safe to call. Verified live after the
   fix: switching to both zone types no longer blanks the display, and
   `WebZone`'s `isAudioMuted()` read back `true` by default as
   intended.

**A real mistake happened during this verification pass, worth
recording precisely**: testing live volume control against the
_actual_ production instance — not a throwaway script — necessarily
plays _actual, audible_ sound through this machine's real, physically-
connected speakers, since the display is genuinely live. Setting a
YouTube zone's volume to 0.4 for a test did exactly that; the user had
to manually turn the volume down in their OS mixer because it was loud
enough to be uncomfortable ("blowing my ears drums out"). Immediately
reset every zone's volume back to 0 and re-confirmed via a full config
scan (no zone anywhere left with `volume > 0`) rather than assuming
the fix took. Lesson for next time (saved to memory too): verify
audio-related behavior on any system with real, physically-connected
speakers by reading back state (`.volume`/`.muted`/`isAudioMuted()`,
or the YouTube player's own `infoDelivery` postMessage state) — never
by actually letting real sound play, whether that's through the live
app or a throwaway script on this same machine (same physical output
device either way).

After all of the above, the live config was fully restored to its
pre-session-3 state (the user's real GIF + stats zones, `Split Zones`
rename kept since that was an intentional change, every volume back to 0) and the app relaunched normally, without the debug port, for
continuous operation.

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
- ~~YouTube zone is broken/unreliable~~ — fixed in Session 3: loads a
  public GitHub Pages relay page via `<webview>` instead of embedding
  YouTube directly. Verified live in the actual installed app, real
  video actually playing on the real panel.
- ~~MKV/video-format support~~ / ~~per-zone volume control~~ / ~~Web
  zone had no muting~~ — all fixed and verified live in the real
  installed app in Session 3, including finding and fixing two severe
  production-only bugs (an `ffmpeg-static`/asar path bug that broke
  every non-native video format, and a webview-not-ready crash that
  blanked the whole display) that no dev-mode probe had caught. See
  Session 3 above for the full detail.
- **RTSP camera path almost certainly had the exact same
  `ffmpeg-static`/asar bug** as the video-transcode path did (both call
  sites now share the same fixed `main/media/ffmpegPath.ts` helper),
  but this still hasn't been verified live with a real RTSP camera —
  there still isn't one on this network. Worth a real test whenever one
  becomes available, since "code review only" already missed this bug
  once.
- ~~The aspect-ratio auto-fit button's actual click-through in the
  Scenes UI wasn't separately verified~~ — done in Session 12, and it
  caught a real bug: see that entry.
- **Dogfood it for real** — this machine is now actually configured to
  drive the physical panel (see Status above). Use it for a while
  before deciding rebrand/UI overhaul scope; some of that scope may
  become obvious from actually living with it.
- Decide when to move on to **rebrand** and/or **UI overhaul** (see
  below) — the user said these wait until after this milestone, which
  just landed, so this is now a real decision point, not a deferred one.

### Not yet started / explicitly deferred

- ~~Rebrand~~ — done in Session 11. See that entry for the full detail
  (naming, packaging, and — the part that actually mattered — migrating
  the live config so the rename didn't lose this machine's real setup).
  ~~No new icon~~ — done in Session 12, see that entry.
- **UI overhaul** — was gated on "see how the first test release feels
  to use first." That gate is now open: after dogfooding, the user
  asked for a full feature/polish pass (see the Roadmap section below).
  Not started yet — needs prioritization first.

## Roadmap: freeform layered canvas + full feature/polish pass

User's own framing, verbatim intent: "this is a pretty good start, but
I think we could have this be feature filled and be able to do many
more things" — asked for (1) a freeform layered canvas (place/scale/
layer multiple GIFs — and by extension other media — freely within a
zone, working both full-bleed and inside a split layout), (2) a broad
brainstorm of further features, and (3) a full pass over the existing
control UI for usability, polish, and customizability. This section is
that plan. Nothing in it is built yet — it's scoped, not started,
pending the user picking where to begin.

### Flagship feature: freeform layered canvas zones (OBS Scenes/Sources model)

User explicitly compared this to how OBS Studio's Scenes work — a
scene contains multiple independently positioned/scaled/stacked
"sources" of _any_ kind (video, image, browser source, capture device,
text, ...), not just one fixed thing. That's the right mental model
and it changes the design for the better: rather than a `layers` zone
holding only media _files_, a layer item should hold a full zone
_source_ — reusing the exact same `ZoneSource` union already used for
top-level zones (`media`/`youtube`/`web`/`stats`/`camera`/`blank`, plus
the new `clock`/`calendar` types below). Concretely, that's what makes
"a resizable YouTube and media box that operates the same way the GIFs
do" fall out for free: a YouTube layer and a GIF layer are the exact
same mechanism — a `ZoneSource` in a free-form box — just with
`source.type` set to `'youtube'` vs `'media'`. No special-casing, and
every zone type (including `stats`, `camera`, even a `web` dashboard,
or another nested `layers` zone) automatically becomes usable as a
freely placed/scaled layer with no extra work per type.

**The core architectural idea**: add a new zone source type,
`type: 'layers'`, alongside the existing types. A `layers` zone holds
an ordered list of items, each an _arbitrary_ `ZoneSource` placed in
its own box (position + size as _fractions_ of the zone's own rect,
0-1, so it scales correctly whether the zone is full-bleed or one
column of a 70/30 split), plus its own opacity and stacking order.
Because `layers` is just another zone _source_ type — the same slot
`resolveZones()` already fills for `media`/`stats`/etc. — it
automatically works in **every** existing layout (`single`, `h`, `v`,
and eventually `grid`) with no changes to the layout system itself.
That's what satisfies "I want that feature on the full screen as well
as the split zone mode": full-bleed is just a `single`-split layout
whose one zone happens to be a `layers` zone; split mode is the exact
same zone type living in one column of an `h`/`v` split next to
another zone (stats, another layers zone, whatever).

Concretely:

- **Schema** (`shared/schema.ts` + `shared/types.ts`): new zone source
  variant, e.g.
  ```ts
  {
    type: 'layers',
    items: Array<{
      id: string
      x: number; y: number          // 0-1, top-left, fraction of zone box
      width: number; height: number // 0-1, fraction of zone box
      opacity: number                // 0-1
      zIndex: number                  // paint/stacking order
      source: ZoneSource              // media | youtube | web | stats |
                                       // camera | clock | calendar | layers
    }>
  }
  ```
  (A `layers` item whose own `source` is itself `type: 'layers'` is a
  natural, harmless consequence of reusing the union rather than a
  feature to build specially — worth allowing, not worth advertising.)
- **Display rendering** (new `LayersZone.tsx`, parallel to
  `Stage.tsx`'s own zone-mapping loop, which it closely mirrors):
  absolutely-positions each item's box inside the zone by converting
  its fractional `x/y/width/height` to percentages (exactly the
  technique `Stage.tsx` already uses one level up, for top-level zone
  rects), sorted by `zIndex`, and renders `item.source` through the
  _existing_ `ZoneRenderer` — meaning `LayersZone` doesn't reimplement
  video/YouTube/web/stats rendering at all, it just nests
  `ZoneRenderer` recursively inside free-form boxes instead of
  layout-computed ones. A media layer holding a video can skip
  `MediaZone`'s gapless dual-buffer loop logic, though — a layer has
  one fixed file, not a rotating playlist, so reusing the existing
  `MediaZone` component as-is (it already handles a fixed single file
  fine) is simplest; no new video-playback code needed at all.
- **Editor UX** — this is the harder half, and worth doing well since
  it's the flagship ask. Proposed: a genuine drag-and-scale canvas
  editor, live in the control window, not a form full of number
  inputs. Concretely:
  - A canvas element (same aspect ratio as the target zone) rendering
    each layer via the _actual_ `ZoneRenderer` at its real position —
    `media://` is registered app-wide (`protocol.handle` is a session-
    level registration, not per-window) and a `<webview>` works in any
    renderer with `webviewTag: true`, so the control window can preview
    real GIFs, real YouTube embeds, real web dashboards, not
    placeholder boxes. This gives a true WYSIWYG editor essentially for
    free — reusing existing components, not building a second
    rendering pipeline.
  - Click a layer to select it (visible selection outline + corner/edge
    resize handles); drag the body to move it; drag a handle to resize
    (optionally shift-constrained to the layer's own original aspect
    ratio — the same aspect-ratio math already built for the Session-3
    "Fit to content" button generalizes directly to this, for layers
    whose source has a real intrinsic size like media/images).
  - A layer list alongside the canvas (thumbnail/icon, a label derived
    from the source type, a visibility toggle, delete, and drag-to-
    reorder for z-index) for when precise stacking/selection by
    dragging alone gets fiddly with many overlapping layers.
  - "+ Add layer" offers the same type picker Scenes already has
    (`TYPE_SWITCH_OPTIONS`: YouTube, Web, Stats, Camera, plus the new
    Clock/Calendar, plus a file/folder picker for media) and drops the
    new layer in centered at a sane default size (e.g. 40% of the
    zone).
  - Per-layer inspector (shown for whichever layer is selected): the
    _same_ per-type controls Scenes already has for that source type
    (fit-mode buttons + volume slider for media, a URL field for
    YouTube/web, widget/style pickers for stats, ...), reused rather
    than rebuilt, plus the layer-level opacity slider that's new here.
  - Keyboard niceties worth including since they're cheap: Delete/
    Backspace removes the selected layer, arrow keys nudge its
    position by a small fraction, Escape deselects.
- Natural extension, not required for v1: let a media layer's source
  be a _folder_ instead of a fixed file (rotating through it the way
  the existing `media` zone's folder mode does). Already falls mostly
  out of reusing `ZoneRenderer`/`FolderMediaZone` as-is, so likely
  cheaper than it sounds — still worth a "later" tag pending the v1
  cut actually landing first.

### New zone-source types unlocked by the same design: clock and calendar

Both requested directly, and both become full `ZoneSource` types —
meaning each is usable _both_ as an ordinary top-level zone (in a
plain `h`/`v`/`single` layout, right alongside `stats`/`media` today)
_and_ as a freely placed/scaled layer inside a `layers` zone, with no
extra work to support the second case once the first exists.

- **`type: 'clock'`** — live time (and optionally date), updating on
  an interval. Configurable: 12h/24h format, show/hide the date line,
  font size (probably auto-scaled via the same container-query
  technique `StatsZone.tsx` already uses so it fills whatever box it's
  given), color, and alignment. No external data source, no
  permissions — purely derived from the system clock, same trust level
  as everything else already in the app.
- **`type: 'calendar'`** — two very different scopes worth naming
  separately since they have very different cost/privacy footprints:
  - **v1 (what "a calendar would be pretty cool too" most likely
    means, matching the ambient/local spirit of the clock widget)**: a
    self-contained month-grid view, today's date highlighted, driven
    purely by the system clock — no accounts, no network, no synced
    data. Same trust/complexity level as the clock widget.
  - **Stretch goal, explicitly separate**: real calendar integration
    (Google Calendar / Outlook / a subscribed `.ics` feed) showing an
    actual upcoming-events agenda. Meaningfully bigger scope — needs
    OAuth or feed-URL credentials stored somewhere, periodic syncing,
    and a real decision about what account access this app should be
    trusted with. Worth keeping explicitly separate from v1 rather than
    quietly assumed; flag for a dedicated discussion (and the user's
    explicit sign-off on the account-access/privacy tradeoff) before
    ever starting it, rather than folding it into the same pass as the
    simple local widget.

### Companion feature that should ship alongside the canvas: a live preview pane in the control window

Right now the control window has **no live preview of the actual
output at all** — every page (Scenes, Layout, Color, Triggers) edits
config blind, and the only way to see the real result is to look at
the physical panel (or use this file's screenshot-based dev-only
verification recipe). This was tolerable for simple per-zone dropdowns
and buttons, but becomes a real usability problem for a drag-and-scale
canvas editor specifically, and is a general polish gap regardless.
Proposed: a persistent small preview panel (e.g. docked in a corner or
a collapsible panel across the top of the control window) that renders
the _actual_ `Stage`/`ZoneRenderer` component tree for the currently-
edited preset, live, scaled down — since the control renderer already
has the full `config` from `useConfigStore` and the same `media://`
protocol access the display window has, this is mostly a matter of
extracting `Stage.tsx`'s zone-resolving/rendering logic into something
importable by both renderers, not building a second rendering pipeline
from scratch. This single change would make every existing editing
page (not just the new canvas) meaningfully more usable.

### Broader feature brainstorm (not yet prioritized — for the user to pick from)

**Visual / creative:**

- A plain custom-text zone/layer type (arbitrary string, not
  time-derived) — styled the same way as the new clock type (font,
  size, color, shadow/outline for legibility over video) — for labels,
  a name plate, a static message, etc. Clock/calendar (above) cover the
  live-data case; this covers the static one.
- Solid-color / gradient (including simple animated gradient) as a
  zone or layer type, for when a plain background is wanted without
  needing an actual image file.
- Crossfade transition when switching presets/scenes, instead of an
  instant cut — would need the display window to briefly hold both the
  outgoing and incoming render during the switch.
- Per-layer visual filters (blur, grayscale, sepia, etc.) independent
  of the global per-preset color profile.
- More trigger-driven visual effects beyond the existing glow/preset-
  switch (the `AlertOverlay`/trigger-engine foundation already exists
  in `triggerEngine.ts` — this would be building more actions on top of
  it, not new infrastructure).

**Scheduling & automation:**

- Time-of-day scene scheduling (e.g. stats-only during work hours,
  ambient GIFs in the evening) — distinct from the existing metric-
  threshold trigger engine, this is calendar/clock-driven, not sensor-
  driven.
- Global keyboard shortcut(s) to switch presets/modes without opening
  the control window at all (useful since it's normally minimized to
  tray).
- "Now playing" media overlay (OS-level now-playing info) — bigger
  lift, needs a real OS media-session API integration; flag as
  exploratory, not scoped.

**Control-app usability / data management:**

- **Preset and layout CRUD.** Right now presets and layouts can only
  be _selected_ and their zones/split edited — there's no way to
  rename, duplicate, or delete a preset or layout from the UI at all.
  For an app whose whole pitch is user-customizable scenes, this is a
  real gap, not a nice-to-have.
- **Config import/export** — back up or transfer the whole config
  (presets, layouts, color profiles, triggers) as a file, and restore
  from one. Currently the only copy of a user's whole setup lives in
  one `electron-store` JSON on one machine.
- **A small media library / recent-files panel** instead of a raw OS
  file dialog every time — especially valuable once there's a folder
  of GIFs someone reuses across many layers/zones (which the flagship
  feature specifically encourages).
- Undo for at least the more destructive editing actions (deleting a
  layer, deleting a preset once that exists) — even a single-level
  undo would meaningfully lower the cost of a misclick in a freeform
  drag-and-scale editor.

### UI/UX audit of the existing control app

Went through `App.tsx`/`Sidebar` and every page
(`Displays`/`Scenes`/`Layout`/`Color`/`Triggers`/`Remote`/`Settings`)
to ground this rather than speculate. Current state: a single dark
theme (`#0b0b0f` background, fuchsia accent, `bg-white/5` bordered
cards throughout) — consistent, but entirely fixed; there is no light
theme, no accent-color choice, and (per the point above) no live
preview anywhere, so every page is a form, not a WYSIWYG editor.
Concrete opportunities, roughly in the order they'd matter to a daily
user:

1. **Live preview** (see above) — the single highest-leverage change;
   affects how every other page feels to use, not just the new canvas
   editor.
2. **Preset/layout rename, duplicate, delete** (see above) — the
   Scenes page's preset picker is presently just a read-only row of
   named buttons.
3. **Accent color / theme customization** — "add UI, color,
   customizability" was explicit in the ask. A settings-level accent-
   color picker (swap the fuchsia for a user-chosen color across the
   whole control app) and a light/dark toggle for the control app's
   _own_ chrome — distinct from a preset's per-panel color profile
   (brightness/contrast/saturation/hue/gamma on `Color.tsx`), which
   already exists and affects the physical panel's output, not the
   control app's own UI.
4. **Empty/loading states** — several pages currently show a bare
   `Loading…`/nothing-selected text with no guidance; worth a pass to
   make first-run and empty states (no displays found, no media picked
   yet, no triggers configured) feel intentional rather than blank.
5. **Sidebar/navigation polish** — confirm every page has a clear
   purpose from its label alone; "Scenes" currently edits _zones for
   the active preset_, which is a slightly confusing name overlap with
   the user's own use of "scene" to mean roughly the same thing as
   "preset" — worth deciding on one consistent term across the whole
   app (UI copy, this file, and code identifiers where practical)
   rather than having "preset"/"scene" mean the same thing in two
   places.
6. **Settings/Triggers page pass** — haven't been touched since they
   were first built; worth a fresh look once the higher-impact items
   above land, to catch anything that reads as a placeholder rather
   than a finished page.

### Wireframe sketches (locked in before implementation started)

**Control window shell — live preview added as a persistent right-hand dock:**

```
+--------+--------------------------------+------------------+
|        |                                | Preview     [<<] |
| side-  |  active page content           | +--------------+ |
| bar    |  (Scenes / Layout / Color /    | |  live render | |
| (icons)|   Triggers / Displays / ...)   | |  of the      | |
|        |                                | |  active      | |
|        |                                | |  preset,     | |
|        |                                | |  scaled down | |
|        |                                | +--------------+ |
|        |                                | Split Zones       |
+--------+--------------------------------+------------------+
```

`[<<]` collapses the dock to a thin strip when screen space is tight;
state remembered per-session (not persisted to config — a UI
convenience, not app data).

**Scenes page, zone card whose source is `type: 'layers'`:**

```
+----------------------------------------------------------+
| zone0                                             [layers]|
| [Media file…] [Media folder…] [YouTube] [Web]             |
| [Stats] [Camera] [Clock] [Calendar] [Layers]               |
|                                                            |
| 3 layers: cat.gif, YouTube, Clock          [Edit layers →]|
+----------------------------------------------------------+
```

Clicking "Edit layers" takes over the Scenes page's whole content
area (not a modal — needs real screen space for the canvas) until
"← Back to zones" is clicked.

**Layers canvas editor (full takeover of the Scenes content area):**

```
+------------------------------------------------------------+
| ← Back to zones              zone0 — Layers         [+ Add ▾]|
+-------------------------------+------------------------------+
|                               | Layers        (drag to order) |
|   ┌───────────┐               | ▤ Clock              👁  🗑   |
|   │           │   ┌────────┐  | ▤ YouTube            👁  🗑   |
|   │  cat.gif  │   │YouTube │  | ▤ cat.gif  (selected)👁  🗑   |
|   │  [::]     │   │  box   │  |------------------------------|
|   └───────────┘   └────────┘  | Inspector — cat.gif            |
|                                | Fit: [Cover][Contain][Stretch]|
|      (drag body to move,      | Volume  ----o----------  20%  |
|       drag [::] handle        | Opacity ----------------o 90% |
|       to resize)              +------------------------------+
+-------------------------------+
```

The canvas renders each layer through the real `ZoneRenderer` (actual
GIF/YouTube/web content, not placeholders) at the zone's real aspect
ratio. Selection outline + one resize handle (bottom-right corner,
shift-drag to unlock aspect ratio, plain drag keeps it locked when the
source has a real intrinsic size) on whichever layer is selected;
click empty canvas space to deselect. "+ Add ▾" opens the same
type-picker Scenes already has, so a new layer of any zone-source type
can be added directly onto the canvas.

**Clock zone/layer, rendered on the actual display:**

```
+------------------+
|                  |
|      14:32       |
|  Thu, Sep 26      |
|                  |
+------------------+
```

Time size auto-scales to the box via the same container-query
technique `StatsZone.tsx` already uses, so it reads fine whether it's
a full-bleed zone or a small corner layer.

**Calendar zone/layer, v1 (local month grid, today highlighted):**

```
+-----------------------------+
|        September 2026       |
| Su Mo Tu We Th Fr Sa         |
|        1  2  3  4  5         |
|  6  7  8  9 10 11 12         |
| 13 14 15 16 17 18 19         |
| 20 21 22 23 24 25 (26)       |
| 27 28 29 30                  |
+-----------------------------+
```

### Suggested sequencing (not a decision — for discussion)

Given the size of all of the above, a reasonable order might be:
(1) live preview pane, since it makes everything after it easier to
build and to use; (2) the freeform layered canvas itself, the
flagship ask; (3) preset/layout CRUD, since a feature-rich canvas
editor without the ability to duplicate/rename/delete presets will
get frustrating fast; (4) the rest of the brainstorm and polish items,
prioritized by the user from here.

**Update: the user confirmed the wireframes above and asked to move
straight to implementing the full roadmap.** Status of each piece is
tracked in the Session 4 entry immediately below.

### Session 4: the flagship canvas, clock/calendar, live preview, and preset CRUD — all landed and verified live

Built, in the order suggested above, and verified end-to-end against
the real installed app on the real hardware (not just isolated
probes) using the same rebuild/reinstall/CDP-drive/restore discipline
established in Session 3.

- **Schema foundation** (`shared/types.ts` + `shared/schema.ts`): three
  new zone-source types — `clock`, `calendar` (v1 local month grid),
  and `layers` (the OBS-style canvas). `layers`/its `LayerItem`s are
  mutually recursive with `ZoneSource` itself (a layer's `source` is a
  full `ZoneSource`, so it can be `media`/`youtube`/`web`/`stats`/
  `camera`/`clock`/`calendar`, or even another `layers` zone) —
  expressed with `z.lazy()` on both schemas, the standard zod pattern
  for a recursive schema.
- **Display rendering**: new `ClockZone.tsx` (updates once per minute,
  aligned to the minute boundary rather than every second, since only
  HH:MM is ever shown) and `CalendarZone.tsx` (a self-contained local
  month grid, today highlighted — re-checks once a minute so a scene
  left running overnight rolls over on its own) — both auto-scale via
  the same container-query technique `StatsZone.tsx` already
  established. New `LayersZone.tsx` renders each layer by delegating
  back to `ZoneRenderer` itself, recursively, in an absolutely-
  positioned fractional box — a layer isn't a separate rendering
  implementation, it's the exact same zone-rendering mechanism used at
  one more level of nesting, which is what makes a resizable YouTube
  layer and a resizable GIF layer trivially the same thing.
- **A real architectural addition to `ZoneRenderer` itself**:
  `isPreview`. Several zone types (`stats`, an RTSP camera, a folder
  media playlist) read `window.display.*` preload APIs that only exist
  in the display window's context and throw if rendered anywhere else.
  Since the _control_ window now also renders real zone content (the
  layers canvas editor's live preview, and the new preview pane below),
  `ZoneRenderer` takes an `isPreview` flag that swaps those three
  specific types for a labeled placeholder, while every other type
  (media, YouTube, web, USB camera, clock, calendar, and layers
  recursively) renders exactly the same real content either way — so
  the control window's previews are genuinely real, not mocked, for
  everything that's actually safe to render there.
- **The layers canvas editor** (`components/LayersEditor.tsx`, reached
  via a "Layers" button + "Edit layers →" on any zone in Scenes): a
  real drag-and-resize canvas — pointer-capture-based drag (moves a
  layer, clamped so it can't be dragged fully off-canvas) and a corner
  resize handle (clamped to a minimum size and to not overflow the
  canvas), a layer list with reorder/visibility-via-opacity/delete, an
  "+ Add" menu offering every zone-source type, and a per-layer
  inspector. Each layer previews as the _actual_ `ZoneRenderer` output
  (`isPreview`) with a transparent hit-layer overlaid on top for
  reliable dragging — a live webview's own compositor can otherwise
  swallow pointer events meant for the drag handler underneath it.
  **Verified live end-to-end**: added a Clock layer, watched it render
  as real live time/date inside the canvas _and_ in the live preview
  pane _and_ on the real physical panel simultaneously; dispatched a
  real pointer drag via CDP's `Input.dispatchMouseEvent` and confirmed
  the layer's stored `x`/`y` updated correctly and clamped exactly at
  its boundary (dragged past the edge, landed at precisely `x: 0.6`,
  the maximum allowed for a `width: 0.4` layer).
- **Shared per-type editor components extracted** into
  `components/ZoneEditors.tsx` (+ `zoneDefaults.ts` for the plain
  constants/factories, split out only because this project's
  `react-refresh/only-export-components` lint rule forbids a component
  file from also exporting non-component values) — `VolumeSlider`,
  `UrlField`, `StatsEditor`, `CameraEditor`, and the two new
  `ClockEditor`/`CalendarEditor`, plus a `ZoneSourceFields` dispatcher
  and a `ZoneTypeSwitcher` button row. These used to be inline, one-off
  JSX in `Scenes.tsx`; now both the top-level zone editor _and_ the
  layers-canvas per-layer inspector call the exact same dispatcher, so
  a future improvement to (say) the stats editor improves it in both
  places automatically rather than needing to stay in sync by hand.
- **Live preview pane** (`components/ScenePreview.tsx`, docked in
  `App.tsx`'s right sidebar, collapsible): renders the active preset's
  real zone tree, scaled down, using the same `isPreview`-gated
  `ZoneRenderer` — not a second rendering pipeline. Deliberately
  ignores the real display's current power-blanked/hidden mode (a
  preview should show what _would_ render, not go blank just because
  the real panel currently is). **Verified live**: changing a layer
  inside the canvas editor updated the preview pane in the same
  screenshot pass, confirming the whole chain (config write → both
  windows re-rendering from the same store) works correctly end to
  end.
- **Preset CRUD** (`Scenes.tsx`'s `PresetChip`): inline rename (click
  the pencil, edit in place, Enter/blur commits), duplicate (clones the
  preset's layout too, so experimenting with a duplicate's split can
  never affect the original — the same clone-on-write principle
  `updateLayoutForPreset` already applies on _edit_, just applied
  eagerly here since a fresh duplicate isn't shared with anything yet),
  delete (confirms first, refuses to delete the last remaining preset,
  and cleans up the associated layout too if no other preset still
  references it), and "+ New" (creates a preset with its own fresh
  full-bleed layout). **Verified live** via screenshot: presets show
  rename/duplicate/delete icons inline, `+ New` present, all rendering
  correctly in the actual installed app.
- **Not done this round, intentionally deferred**: layout-level CRUD
  beyond what preset-duplicate's auto-cloning already covers (rename/
  delete a layout independent of any preset), and everything further
  down the brainstorm list (transitions, scheduling, hotkeys, a media
  library panel, config import/export, control-app theming/
  accent-color customization, the general page-by-page UI polish
  audit, real calendar-account integration). All still exactly as
  scoped in the Roadmap section above — this session focused on the
  four items explicitly sequenced first.
- Config was fully restored to its pre-session state afterward (via
  the real `config:set` IPC path, not a raw file edit) and re-verified
  byte-for-byte identical (`presets`/`layouts`/`activePresetId` all
  matched the backup taken before testing began); the app was
  relaunched normally, without the debug port, for continuous
  operation — same discipline as every other session in this file.

### Session 5: more roadmap items — Text/Color zone types, accent theming (with a real bug caught live), global hotkeys, config import/export

Continued straight through the roadmap per the user's "keep going until
we've got a fresh new revised product." Landed, in this order:

- **`text` and `color` zone/layer types** — a static custom-text zone
  (font/color/align/size/bold) and a solid-or-gradient background zone,
  both full `ZoneSource` types so they work as top-level zones or
  layers automatically, same as clock/calendar. **Verified live** on
  the real panel: a 45°, fuchsia→cyan gradient rendered correctly
  beside the real stats zone.
- **Control-app accent color theming** (`Settings` → Appearance): a
  color picker + 8 swatches re-theme the whole control app's UI.
  **A real bug was found and fixed during verification**: the first
  implementation derived shades via CSS `color-mix()` on `:root`, but
  Tailwind v4's processor (Lightning CSS) silently rewrites
  `color-mix()` into a plain-value fallback plus an `@supports`-gated
  override — both still scoped only to `:root`. Overriding `--accent`
  on a descendant div (the intended mechanism) left the whole control
  UI stuck on the original fuchsia default; only the raw `--accent`
  variable itself updated, not anything derived from it. Confirmed via
  `getComputedStyle` on the actual button in question, then fixed by
  computing every shade directly in JS
  (`renderer/control/src/lib/accent.ts`) and setting all of them as
  plain `rgb()`/`rgba()` inline custom properties — no CSS-side
  derivation at all. Re-verified live: switching to cyan now correctly
  recolors the sidebar's active-item highlight and everywhere else.
- **Global hotkeys** (`main/hotkeys.ts`, off by default in Settings):
  Ctrl/Cmd+Alt+1-9 activates the preset in that position, +L/B/D
  switches live/black/desktop mode. Re-registers only when the
  enabled flag or the preset-id list actually changes, not on every
  config write. **Not live-tested** — `globalShortcut` needs a real OS-
  level key press, which isn't reachable via CDP the way everything
  else this session was verified; the Settings toggle and the
  underlying register/unregister calls were confirmed by code review
  and typecheck only.
- **Config export/import** (`Settings` → Backup): exports the whole
  config as one JSON file (explicitly flagged in the UI that it
  includes the Remote page's access token — treat it like a password);
  import validates against the full zod schema before replacing
  anything, so a malformed or foreign file can't corrupt the store.
  Not live-tested this round (ran out of session budget right after
  the theming fix) — code review + typecheck only so far.
- **Cut short by hitting the usage limit** mid-verification-pass, right
  after confirming the gradient color zone live on the real panel.
  Config was fully restored (verified against the pre-session-5 backup
  — `presets`/`layouts` byte-identical, `app` differs only by the two
  brand-new fields sitting at their correct defaults) and the app
  relaunched normally. **Not yet done from the roadmap**: everything
  else in the "Broader feature brainstorm" (crossfade transitions,
  time-of-day scheduling, a media library panel), layout-level CRUD,
  the page-by-page UI polish/naming-consistency audit, and light/dark
  theming (a separate, bigger effort than accent color alone — the
  rest of the app's dark colors are still hardcoded). Config
  import/export specifically also still needs a real live round-trip
  test (export, verify file contents, import, confirm it reapplies)
  before it should be considered done rather than just "typechecks."

### Session 6: closed out Session 5's two unverified items

- **Global hotkeys, actually confirmed at the OS level.** CDP can't
  simulate a real physical key press, so instead launched the app with
  both `--remote-debugging-port` (renderer) and `--inspect` (main
  process Node inspector), enabled hotkeys via config, and called
  `globalShortcut.isRegistered(...)` directly in the running main
  process. Confirmed all of Ctrl+Alt+1/2/3 (matching the 3 presets
  actually configured) registered `true`, Ctrl+Alt+5 (past the preset
  count) correctly `false`, and Ctrl+Alt+L/B/D all `true`; then
  disabled hotkeys via config and re-checked — all `false`. This is
  real confirmation Windows accepted the registration and Electron's
  callback is actually attached, not just that the code typechecks.
- **Config export/import, actually round-tripped.** Native Save/Open
  dialogs can't be driven via CDP either, so temporarily monkey-patched
  `dialog.showSaveDialog`/`showOpenDialog` in the live main process
  (via the same Node inspector connection) to return fixed paths
  instead of opening real UI, restoring the originals immediately after
  each test. Confirmed: (1) importing a deliberately invalid file
  (`{nonsense: true}`) was rejected with a clear, readable error and
  didn't touch the live config; (2) importing a valid file with
  `activePresetId` changed to `stats-only` actually replaced the live
  config end to end — the IPC call's own return value reflected the
  new value; (3) exporting wrote a real, complete file (`presets`
  array, correct `activePresetId`, `remote.token` present as
  documented). Config was fully restored afterward and re-verified
  byte-for-byte identical to the pre-session backup, then the app was
  relaunched normally.
- **Layout rename** added to the Layout page (inline text input,
  commits on blur/Enter) — the same pattern as the already-verified
  preset rename, not separately live-tested given how directly it
  mirrors that one.
- **Crossfade transitions between presets** (`display.transitionMs`,
  a new Settings section with Off/Fast/Medium/Slow presets, default
  Off — matches every other new feature this project defaults new
  behavior to opt-in). `Stage.tsx` now tracks a small stack of
  presets-in-transition, resolving each one fresh from the live config
  every render rather than snapshotting, so a zone edit made mid-fade
  (even to the outgoing preset) is never stale.
  - **Two real bugs found and fixed live**, not just reasoned about:
    (1) the first version marked the _outgoing_ layer invisible at the
    same moment the incoming one was added, so both layers went to
    opacity 0 simultaneously — a flash to black followed by the new
    content fading in from nothing, not an actual cross-fade between
    old and new. Fixed by leaving the outgoing layer alone (it stays
    fully visible underneath) and only ever fading the incoming layer
    in on top, removing the outgoing one only once it's fully covered.
    (2) Even after that fix, a screenshot taken immediately after
    switching presets with a 6-_second_ transition configured showed
    the incoming preset already fully opaque — a classic CSS gotcha:
    inserting an element at `opacity: 0` and flipping it to `opacity: 1`
    within the same animation frame (a single `requestAnimationFrame`)
    never gives the browser an actual paint at the starting value, so
    the `transition` has nothing to animate from and jumps straight to
    the end state. Fixed with a double `requestAnimationFrame` (the
    outer one guarantees a real 0-opacity paint before the inner one
    flips visibility). Both bugs were confirmed via a rapid sequence of
    real screenshots taken ~400ms apart during an actual preset switch
    on the real installed app — the fixed version shows a clean,
    genuinely blended crossfade (both presets' content visible and
    blending together mid-transition), confirmed at multiple points
    across the fade, not just before/after.
  - The lint fix for the "adjust state during render" logic (adding a
    new transition layer) also matters beyond style: this project's
    `react-hooks/set-state-in-effect` rule flagged the original
    effect-based version, and the fix (computing the next `layers`
    value directly during render, guarded by a tracked-preset-id ref)
    is the React-documented pattern for exactly this "derive next
    state from a changed prop, using the previous committed state"
    case — an effect can't safely do this without the exact
    synchronous-setState pattern the lint rule exists to catch.
  - Config (including `display.transitionMs` specifically, which
    needed restoring back to `0` in addition to the usual
    presets/layouts/activePresetId) was fully restored afterward and
    re-verified byte-for-byte identical to the pre-session backup, then
    the app was relaunched normally.
- **Time-of-day scheduling** — a new `AppConfig.schedule` array
  (`ScheduleEntry`: name, target preset, `HH:MM` time, a `days` list
  where empty means every day, enabled flag) and a new main-process
  `Scheduler` (`main/scheduler.ts`), distinct from the existing metric-
  threshold `TriggerEngine` — this one just checks the clock. Checks
  every 15s and fires a matching entry's preset switch at most once per
  entry per matching minute (a `lastFiredKey` guard, since a 15s check
  interval doesn't align perfectly with minute boundaries and would
  otherwise fire the same entry two or three times). UI: a new
  "Schedule" section in Settings — add/enable/rename/retime/re-target/
  delete an entry, with a row of day-of-week toggle buttons per entry.
  **Verified live on the real installed app**: added an entry
  targeting a different preset at the _exact current_ time, waited
  ~18s, and confirmed `activePresetId` actually changed on its own —
  not simulated, the real main-process scheduler running in the real
  installed build fired a real preset switch. Also confirmed it didn't
  immediately re-fire after manually switching back within the same
  matching minute. Config (including clearing the test schedule entry)
  was fully restored and re-verified byte-for-byte identical to the
  pre-session backup afterward, then the app was relaunched normally.

### Session 7: naming consistency, a media library quick-pick, and an honest re-check of the rest of the UI audit

- **"Preset"/"Scene" naming consistency**, the specific gap called out
  in the original UI audit — every place a user actually reads the
  word "preset" (the Scenes page's own section heading, the tray menu,
  the Remote page's mobile UI, Settings' hotkey/transition/backup/
  schedule copy, empty-state messages, the delete confirmation dialog,
  a newly-created scene's default name) now says "scene" instead,
  matching both the user's own language and the Scenes page's existing
  label. Left the internal `Preset` type/variable names alone — renaming
  those is a large, purely-cosmetic, higher-risk refactor for zero
  additional user-facing benefit; only what's actually displayed needed
  to change.
- **Recent-media quick-pick** (`AppConfig.recentMedia`, an MRU list
  capped at 15, deduplicating): every place a media file gets picked
  (the top-level zone editor's "Media file…" button, the layers
  canvas's "+ Add" menu) now also records it, and both places gained a
  "Recent" entry point (a dropdown button in the zone editor, a
  "Recent" section inside the layers canvas's Add menu) listing
  previously-used files by name, skipping the OS file dialog entirely
  when reusing one. **Verified live**: seeded `recentMedia` with real
  paths, confirmed the dropdown lists the correct filenames while the
  button's `title` attribute carries the full real path — caught and
  fixed a test-script escaping bug of my own along the way (the backup
  config seeded via one script had genuinely lost its path separators;
  confirmed this was purely how _my test_ embedded the string, not a
  real app bug, by re-seeding correctly and re-checking the DOM
  directly rather than trusting a screenshot at small size).
- **Re-checked the rest of the original UI-polish audit against the
  actual current code**, rather than assuming the earlier speculative
  list was still accurate: empty/loading states (Triggers' zero-state
  message, `ScenePreview`'s "No active scene", Color/Layout's guard
  states) are already handled reasonably everywhere that matters in
  practice; the Displays and Camera-device lists don't have dedicated
  empty states, but a computer always reports at least one display and
  the camera picker already falls back to "System default" when no
  device is found, so this genuinely isn't a real gap. The Triggers
  page specifically (flagged as "might read as a placeholder") turned
  out to already be fully built out — live telemetry preview per
  trigger, editable name, full add/remove — nothing there needed
  touching. Reporting this honestly rather than making cosmetic changes
  just to have done something.
- **Still not started**: true light/dark theming. This is
  substantively bigger than the accent-color work already done — every
  page's actual background/text/border colors (`bg-[#0b0b0f]`,
  `text-white`, `bg-white/5`, `border-white/10`, and their many
  variants) are hardcoded dark throughout roughly a dozen files, not
  parameterized at all, unlike the accent color which already went
  through exactly this kind of CSS-custom-property conversion. Doing
  this properly means the same semantic-token approach (`--bg-primary`,
  `--bg-secondary`, `--text-primary`, `--text-secondary`, `--border`,
  computed in JS the same way `computeAccentVars()` already proved
  necessary rather than trusting CSS `color-mix()`/`@supports`
  fallbacks not to interfere) applied consistently across every page —
  a larger, higher-risk mechanical change than anything else in this
  session, worth its own dedicated pass rather than rushing. Also
  worth a real product question before starting it: this app's control
  window is realistically used in the same dim room as the physical
  panel it's configuring, so a light theme's actual value here is
  genuinely less obvious than the accent-color customization was —
  worth confirming demand before investing in it, not just building it
  because it was on the original brainstorm list.
- Config was fully restored via a new, more robust restore script
  (`restore-full-config.js`, which sends the entire backed-up config
  object as one `config:set` patch instead of the earlier per-field
  scripts) and re-verified with a proper key-order-independent deep
  comparison rather than a naive string match — the backup predated
  this session's new schema fields (`recentMedia`, and `schedule`'s
  default), so a literal string comparison falsely flagged a mismatch
  that was actually just those fields sitting at their correct empty
  defaults. The app was relaunched normally afterward.

### Session 8: light/dark theming, the item Session 7 flagged as "still not started"

- **Full light/dark theme support for the control app's own chrome**
  (the physical display output is untouched — it always renders exactly
  what a scene is configured to show, regardless of this setting).
  Followed the exact technique the accent-color work already proved
  necessary: every semantic surface/text/border shade
  (`--bg-app`, `--surface-0` through `--surface-3`, `--surface-sidebar`,
  `--surface-popover`, `--border-1`/`--border-2`, `--text-1` through
  `--text-6`) is computed as plain hex/`rgba()` strings in JS
  (`lib/theme.ts`'s `computeThemeVars()`, a sibling to the existing
  `computeAccentVars()`), never via CSS `color-mix()` — Tailwind v4's
  Lightning CSS processor rewrites `color-mix()` into a plain-value
  fallback plus an `@supports`-gated override that only actually take
  effect on `:root`, so a descendant override doesn't make derived
  properties re-resolve. Both values are merged into one inline `style`
  object on the app root in `App.tsx`.
- Every hardcoded dark-theme Tailwind color utility across the control
  renderer (`text-white*`, `bg-white/*`, `border-white/*`, `bg-black/30`,
  the two literal `#15151b`/`#0b0b0f` hex backgrounds — over 300
  occurrences across roughly a dozen files) was bulk-converted to the
  matching semantic token via `sed`. One bulk `sed` invocation silently
  aborted partway through because `#` was used as the delimiter while
  the pattern itself contained literal `#15151b`/`#0b0b0f` — confirmed
  by re-grepping and finding zero change, fixed by splitting the
  hex-color replacements into their own invocation with a different
  delimiter, then re-running the rest, and confirmed clean with a
  final zero-hits grep.
- Manually reviewed every remaining hardcoded `bg-black`/`bg-white`
  hit individually rather than blindly converting them: the Layers-canvas
  and Layout-page split-preview panels' `bg-black` and the Remote page's
  QR-code `bg-white` are deliberately left alone (they represent the
  physical panel's always-black background and a QR code's functional
  black-on-white contrast, not app chrome, so they must not follow the
  control app's own theme). Found and fixed one genuine cross-theme bug
  this review surfaced: the selected-accent-swatch ring in Settings was
  a hardcoded `border-white`, which would've been invisible against a
  light theme's page background — changed to `border-[var(--text-1)]`.
- Added `app.theme: 'dark' | 'light'` to `AppConfig` (schema default
  `'dark'`, matching the app's pre-existing look exactly) and a
  Dark/Light toggle in Settings → Appearance, next to the accent-color
  picker.
- **Verified live** on the real installed build (not just dev mode):
  backed up `config.json`, ran `build:win`, silently installed, killed
  the installer's auto-launched instance, relaunched with
  `--remote-debugging-port`, and drove the real Settings page through
  CDP — clicked the Light button, screenshotted (readable dark text on
  a light gray background, all sections legible, active-nav-item
  contrast fine), clicked Dark, screenshotted again (pixel-identical to
  the pre-toggle dark screenshot), then separately checked the Scenes
  page under the light theme too. One screenshot came back with a
  diagonal tear artifact; re-screenshotting immediately after showed a
  clean frame, confirming it was a one-off capture-during-repaint
  artifact rather than a real rendering bug. Restored the backed-up
  config and relaunched the app normally afterward — confirmed the
  restored file (from before this session, so it predates the new
  `theme` field) loads fine and `getConfig()` fills in the `'dark'`
  default in memory without needing an immediate disk rewrite, the same
  additive-field behavior already relied on for `accentColor` and
  `hotkeysEnabled`.

### Session 9: undo for destructive scene/layer deletes

- Ran a fork to reconcile PLAN.md's "Roadmap"/"Broader feature
  brainstorm" sections against the actual current code, since most of
  that planning text predates Sessions 4-8 actually building it. Result:
  the flagship layers canvas, clock/calendar, live preview, preset CRUD,
  crossfade transitions, hotkeys, config import/export, scheduling,
  accent/light-dark theming, and the recent-media picker are all done —
  that planning text is stale there, not a real backlog. The genuinely
  open items, in order of how safe/self-contained they are to build
  without further user input: (1) undo for destructive deletes — done
  this session; (2) per-layer visual filters (blur/grayscale/sepia) on
  `LayerItem`, small-medium; (3) more trigger-driven visual effects
  beyond glow/preset-switch, medium but needs picking a concrete set;
  (4) an OS media-session "now playing" overlay, larger and needs API
  research first; (5) real calendar-account integration, gated on the
  user choosing an OAuth/feed-URL approach; (6) the SuperDuperDisplay
  rebrand, gated on the user greenlighting the actual cutover (new
  appId/icon/renamed strings invalidate the current install/shortcuts).
- **Added undo for deleting a scene (Scenes page) and deleting a layer
  (the flagship layers canvas editor)** — both previously permanent
  (scene delete had a `window.confirm()`, layer delete had no
  confirmation at all, making it the actual risk given how easy an
  accidental click is on a dense drag/resize canvas). Replaced the
  scene-delete confirm dialog with the same instant-delete-plus-undo
  pattern rather than keeping both (a confirm dialog _and_ a post-hoc
  undo would be redundant friction). Implementation: a single-slot
  `useUndoStore` (Zustand) holds one pending `{ label, restore }` at a
  time — offering a new one replaces whatever was pending, since
  stacking out-of-order restores isn't meaningful for this simple a
  model — surfaced via a bottom-center `UndoToast` mounted once in
  `App.tsx`, auto-dismissing after 6 seconds. Each call site captures
  the pre-delete value (the preset/layout/activePresetId trio for
  scenes, the full `items` array for layers) in a closure before
  mutating, so "Undo" is just patching that snapshot back — no generic
  history stack, since only these two call sites need it today.
- **Verified live** on the real installed build via CDP against the
  actual running app: created a throwaway scene, deleted it, confirmed
  the config's preset list actually shrank, confirmed the toast read
  `Deleted scene "New scene"`, clicked its Undo button, confirmed the
  scene count and name list were back to exactly the pre-delete state.
  Separately, opened the flagship layers editor, added a Color layer via
  the real "+ Add" menu, deleted it via the layer list's trash icon,
  confirmed the toast read `Removed layer "Color"`, clicked Undo,
  confirmed the "No layers yet" empty-state text was gone again (the
  layer came back). Hit and fixed one test-script bug of my own along
  the way: an early click-by-text-match helper matched the sidebar
  nav's "Color" link before the layers-editor's own dropdown "Color"
  option, since `querySelectorAll('button')` returns the sidebar's
  buttons first in DOM order — fixed by scoping the test's click helper
  to exclude anything inside the `<nav>` element, not an app bug.
  Config was backed up before this round of testing and restored
  afterward; the app was relaunched normally.
- **Per-layer visual filters** (item #2 from the same audit): each
  `LayerItem` now carries a `filter: 'none' | 'grayscale' | 'sepia' |
'blur' | 'invert'` (schema-defaulted to `'none'` for existing configs).
  The actual CSS mapping (`layerFilterCss()`) lives in a new
  `shared/layerFilter.ts` so the display's `LayersZone.tsx` and the
  control app's `LayersEditor.tsx` canvas preview render identically
  from one source of truth, rather than duplicating the filter-string
  logic in two places. Applied to the layer's _content_ wrapper only,
  not the outer positioned box that also carries the selection outline/
  resize handle — otherwise a `blur` filter would blur the editor's own
  selection UI along with the layer. A button row (None/Grayscale/
  Sepia/Blur/Invert, styled like the existing fit-mode button group) was
  added to the per-layer inspector in the layers canvas editor.
  **Verified live**: added a Color layer, applied Grayscale (canvas
  preview and the Scenes-page live scene preview both turned the swatch
  gray), applied Blur (both previews showed a genuine blurred glow),
  switched back to None, then deleted the test layer to clean up.
- **One-shot "flash" trigger effect** (item #3 from the same audit —
  picked the smallest safe slice of "more trigger-driven visual
  effects" rather than guessing at a broader set): a new
  `Trigger['effect']` variant, `{ type: 'flash'; color: string }`,
  alongside the existing `glow`/`preset`. Deliberately did **not** add a
  "shake" effect alongside it as the audit's suggested pairing —
  `Stage.tsx`'s outer content box already carries a `transform:
translate(-50%,-50%) ${rotation}` for panel rotation, and composing a
  shake animation onto that same transform correctly (without breaking
  rotation or the existing crossfade logic) is real risk for a feature
  that wasn't asked for; `flash` alone needed no changes to `Stage.tsx`
  at all, since it's an additive overlay exactly like the existing
  `glow` effect. Unlike `glow` (a pulsing vignette that stays on for as
  long as the trigger condition holds), `flash` fires once on the
  _rising edge_ of a trigger newly becoming active and fades over 700ms
  — the main process only reports the trigger's current level
  (active/inactive) each telemetry tick, so the edge detection
  (comparing the newly-arrived `TriggerState.activeTriggerIds` against
  the previous tick's) is done client-side in `AlertOverlay.tsx`, the
  same component that already renders `glow`. Added a "One-shot flash"
  option to the Triggers page's effect dropdown, reusing the same color
  picker already built for `glow`.
  **Verified live in Session 10** — see below.

### Session 10: verified the one-shot flash effect on the real installed app

Picked up exactly where Session 9 left off. Note: the always-on instance
wasn't running when this session started (likely a reboot since Session
9; not investigated further since the fix was to just relaunch it).

- Backed up `config.json`, silently installed `dist/minidisplay-1.0.0-
setup.exe` (the build Session 9 already produced with the flash effect
  baked in — no rebuild needed), and launched it with
  `--remote-debugging-port=9222`.
- Drove both CDP targets directly with a small dependency-free Node
  script (`node`'s built-in `WebSocket`, no `chrome-remote-interface`
  needed) rather than the Chrome-extension browser tools, since these
  are raw Electron CDP targets, not Chrome tabs. Called
  `window.control.config.set({ triggers: [...] })` on the control
  window's target to add a throwaway trigger (`metric: 'cpuLoad', op:
'>', value: 0, holdSec: 0, clearBelow: -1, effect: { type: 'flash',
color: '#00ff00' }`) — exactly the recipe Session 9 specified.
- **First attempt missed the flash**: `flash` is edge-triggered
  (fires once when a trigger newly becomes active), and the trigger's
  rising edge happened in the ~1s gap between adding it and starting
  the polling scan, before any observation could catch it. Confirmed
  the trigger engine itself was working correctly regardless — reading
  back `window.__lastTriggerState` (captured via
  `window.display.onTriggerState`) showed the real `TriggerState` with
  the flash effect present, so the end-to-end wiring was never in
  doubt, just the timing of the observation.
- **Re-armed and caught it live**: removed the test trigger (clearing
  the rising-edge state), started the display-window poll loop, then
  re-added the trigger from a second concurrent call ~1s into the poll.
  Caught a real `<div>` with
  `style.animation = "700ms ease-out 0s 1 normal forwards running
minidisplay-alert-flash"` present across 7 consecutive 100ms polls
  (~1839ms-2260ms+ into the scan, consistent with the 700ms fade) and
  gone afterward — a genuine one-shot flash rendering and fading on the
  real installed build, not simulated or reasoned about.
- Removed the test trigger, confirmed the live config matched the
  pre-test backup exactly except for `app.theme: 'dark'` (the same
  documented additive-field behavior from Session 8 — the backup
  predates that field, the schema fills the default in memory), and
  relaunched the app normally, without the debug port, for continuous
  operation.

**This closes out the last unverified item from the Session 9 audit.**
Everything in that audit's numbered list (undo, per-layer filters,
one-shot flash) is now built and live-verified. Remaining open items
from that same audit, not yet started: an OS media-session "now
playing" overlay (needs API research first), real calendar-account
integration (gated on the user picking an OAuth/feed-URL approach), and
the SuperDuperDisplay rebrand (gated on the user greenlighting the
actual cutover, since it invalidates the current install/shortcuts).

### Session 11: all three remaining Session-9-audit items — now-playing overlay, real calendar integration, and the rebrand — landed in one session

User explicitly greenlit all three at once ("do media-session 'now
playing' overlay, do real calendar-account integration, and do the
SuperDuperDisplay rebrand"), closing out every gate the Session 9 audit
had left open. All three built, and — critically, since this machine
actively drives the real physical panel — verified live against a real
rebuilt-and-reinstalled build, not just reasoned about or typechecked.

**Now-playing media-session overlay** (`type: 'nowplaying'` zone
source): shows whatever's currently playing in _any_ app on the
machine (a browser tab, Spotify, anything with a media session), not
tied to this app's own media zones.

- Windows exposes this via `GlobalSystemMediaTransportControlsSessionManager`,
  a WinRT API — reached without a native Node addon or any new npm
  dependency by shelling out to `powershell.exe` with a small script
  that reflects `System.Runtime.WindowsRuntime`'s `AsTask` extension to
  await the WinRT call (`main/media/nowPlaying.ts`), passed via
  `-EncodedCommand` (base64 UTF-16LE) to sidestep all quoting concerns.
  **Verified live before writing any Node code**: ran the bare
  PowerShell script directly first, confirmed it returned real
  title/artist/status/appId for whatever was actually playing
  (~330ms/call — cheap enough to poll every 2s), _then_ confirmed the
  exact same script worked identically when invoked via Node's
  `execFile` with `-EncodedCommand` before wiring it into the app —
  the "verify an unfamiliar OS-specific API live before depending on
  it" discipline this file has flagged before, applied up front this
  time instead of after a bug forced it.
- `NowPlayingService` polls every 2s (mirrors `TelemetryService`
  exactly), broadcasts to the display window only via a new
  `NowPlayingTick` IPC channel. `NowPlayingZone.tsx` (display-only,
  container-query sized like `ClockZone`) shows a status icon
  (▶/⏸/■), title, and artist; gated behind `isPreview` in
  `ZoneRenderer.tsx` exactly like `stats`/RTSP camera/folder media,
  since it depends on a display-window-only push channel.
- **Verified live** on the real installed build: temporarily pointed a
  real preset's zone at `nowplaying`, read the actual display window's
  rendered text via CDP — showed the real title/artist of a video
  actually playing in a Chrome tab on this machine at the time
  (`▶ / "12VHPWR Problems Are Shocking..." / "der8auer EN"`), not a
  mock.

**Real calendar integration** (`calendar` zone's new `mode: 'agenda'`,
alongside the existing `mode: 'grid'` v1): upcoming events from a
subscribed `.ics` feed URL.

- **Deliberately scoped to feed-URL, not OAuth** — flagging this choice
  rather than silently deciding it: every calendar provider (Google,
  Outlook, Apple Calendar) offers a "secret address"/publish-as-ICS
  export that needs no account sign-in from this app at all, versus
  OAuth which would need the user to first go register a developer app
  with that provider and hand this app a client secret to store. Given
  the ambient/local trust level every other feature in this app has
  stayed at (the clock/grid-calendar's own v1 scoping note said the
  same thing), feed-URL is the only approach that doesn't require
  another out-of-band setup step before this feature can even be
  tested. Real OAuth account integration is still explicitly listed as
  a separate, bigger-scope stretch goal if ever wanted later.
- New dependency: `node-ical` (pure JS, no native bindings) — chosen
  over hand-rolling ICS/RRULE parsing, since recurring-event expansion
  (RRULE + EXDATE + RECURRENCE-ID overrides + DST) is exactly the kind
  of fiddly-and-easy-to-get-subtly-wrong logic worth using a
  well-tested library for rather than reinventing. Its
  `expandRecurringEvent()` handles recurring _and_ one-off events
  through the same call — **verified live against a real public ICS
  fixture** (a multi-day recurring festival calendar from node-ical's
  own test suite) before writing `main/calendar/ics.ts`, confirming the
  exact instance shape or an assumed API this file predicted correctly.
- `main/calendar/ics.ts`: fetches + parses on demand, caches per URL
  for 5 minutes (an ICS feed doesn't need second-level freshness), and
  on a fetch/parse failure falls back to whatever's still cached rather
  than blanking a zone that was showing real events a moment ago.
  Exposed via a new `CalendarAgenda` invoke channel added to _both_
  preloads (`control.ts` and `display.ts`) — unlike now-playing, this
  needed no display-only push channel, so `CalendarZone.tsx`'s agenda
  mode renders real content in the control window's previews too, same
  as its existing grid mode, no `isPreview` placeholder needed.
- **Verified live** end-to-end on the real installed build: since the
  only public ICS fixtures available had all their real occurrences
  too far in the past to fall inside the "upcoming 2 weeks" window,
  spun up a tiny local HTTP server serving a synthetic `.ics` with one
  event 2 days out, pointed a real preset's zone at it, and read the
  actual display window's rendered text via CDP — showed the correct
  formatted date/time and title, fetched and parsed by the real main
  process, not mocked.

**The SuperDuperDisplay rebrand** — the part of this session with real
teeth, since this machine's install isn't a dev sandbox, it's actively
driving the real physical panel with real user-built presets/layouts/
triggers/schedule, and Electron's userData path (where all of that
lives) is derived from `package.json`'s `name` field.

- Renamed everywhere a person actually sees it: `package.json` name,
  `electron-builder.yml` (`appId: com.zedhand.superduperdisplay`,
  `productName`/`executableName: SuperDuperDisplay`), the Windows
  `AppUserModelId` in `main/index.ts`, both renderer `<title>`s, the
  control sidebar's own branding text, the tray tooltip/menu label, the
  LAN remote page's title/heading, the config export/import
  filename/file-picker-filter/error-message strings, and the README.
  **Deliberately left untouched**: internal, non-user-visible
  identifiers that happen to contain "minidisplay" — the RTSP
  multipart boundary string, the `MINIDISPLAY_AUTO_CAPTURE` dev env
  var, the debug-capture temp filename, the `AlertOverlay` CSS
  `@keyframes` names, the `colorProfile.ts` SVG filter id — renaming
  these would be pure churn with zero user-facing benefit. Also
  deliberately left untouched: the `minidisplay-yt-embed` GitHub Pages
  relay (Session 3) — that's a real external repo/URL this app depends
  on for YouTube playback; renaming the string without renaming the
  actual repo would just break it, and renaming the actual repo is an
  explicitly separate decision, not bundled into this app's own rename.
- **No new icon.** No source art was supplied and none was generated —
  the app still ships the old MiniDisplay icon file, just under the new
  name. Flagged as a known placeholder, not silently passed off as
  finished.
- **The part that actually mattered: config migration.** Renaming
  `package.json`'s `name` moves Electron's default `userData` path
  (`%APPDATA%/minidisplay` → `%APPDATA%/superduperdisplay`), and this
  machine's `minidisplay` folder held the real, live config — every
  preset/layout/trigger/schedule/remote-token the user has actually
  built, not test data. Added a one-time migration in `store.ts`,
  running _before_ `electron-store`'s own `Store` is constructed: if
  the new userData folder has no `config.json` yet but the old sibling
  `minidisplay` folder does, copy it over (copy, never move — the
  legacy file is left untouched as a safety net). No-op on every later
  launch once the new folder has its own file.
- **Verified live, the same rebuild-reinstall-CDP-drive-restore
  discipline this file has used since Session 3**: backed up the live
  config, built `dist/superduperdisplay-1.0.0-setup.exe`, killed the
  running MiniDisplay instance, silently installed the new build,
  launched it with `--remote-debugging-port`, and confirmed via CDP:
  (1) both windows' titles read "SuperDuperDisplay"/"SuperDuperDisplay
  Output"; (2) the migrated `%APPDATA%/superduperdisplay/config.json`
  matched the pre-rebrand backup exactly — same 4 presets, same
  `activePresetId`, same trigger — not schema defaults; (3) the display
  window actually rendered real live telemetry on the real panel
  (`CPU Temp 50°C`, `GPU Load 27%`, real numbers) under the new
  install, confirming the whole pipeline — not just the config file —
  survived the rename; (4) both new features (above) verified against
  this same renamed, migrated build. Installer is still **not
  code-signed** (`Get-AuthenticodeSignature` → `NotSigned`), same as
  every prior build — not a regression, just not addressed.
- **Cut over for real, not left running in parallel**: uninstalled the
  now-superseded MiniDisplay program (silent uninstall of its Start
  Menu entry/program files) once the SuperDuperDisplay install was
  confirmed working — deliberately left `%APPDATA%/minidisplay`'s
  config data physically untouched as a safety net (uninstallers remove
  program files, not userData) rather than deleting it. Relaunched
  SuperDuperDisplay normally, without the debug port, for continuous
  operation. Checked `app.launchAtLogin` in the migrated config before
  finishing — it was `false`, so there's no stale Windows login-item
  registration pointing at the now-deleted old exe path to worry about;
  worth a first check if this ever comes up again for a machine that
  had it enabled, since `app.setLoginItemSettings` keys off the
  _current_ exe's own path, not the old one.

With this session, every item from the Session 9 audit is now closed
out. What's left, per that same audit's own ordering: real
calendar-_account_ integration (OAuth, explicitly deferred above, gated
on the user picking a provider and accepting the account-access
tradeoff), an OS-level "now playing" _overlay for this app's own
playback_ is out of scope (this session's feature reads the OS-wide
now-playing session, which was the actual ask), and a new app icon
(flagged above, no source art available). Otherwise the roadmap this
file has tracked since the OBS-style canvas was first scoped is fully
built.

### Session 12: a real app icon, the README refresh, and the last unverified item from Session 3 — which turned up a real bug

Asked "what else do we need to address," given a prioritized answer
(two safe items with no open decision, plus two gated ones), and the
user picked the two safe ones — then, mid-turn, also asked for the
icon specifically: "make it like an icon of a monitor with 'SDD' in
the middle of the display or something similar."

- **New app icon.** `ImageMagick` (already installed on this machine)
  turned out to be enough — no external design tool needed. Hand-wrote
  `build/icon.svg` (a monitor frame + stand in the control app's own
  dark chrome color, screen filled with the same fuchsia→cyan gradient
  the Color zone/Calendar's accent already default to, bold white
  "SDD" centered) and rasterized it to the full asset set: `icon.ico`
  (16/24/32/48/64/128/256px layers, packed with `magick a.png b.png
... icon.ico`), `icon.png` (512px, also the tray icon at
  `resources/icon.png`), and `icon.icns` for mac. Checked legibility at
  small sizes before finalizing — screenshotted 32px and 16px
  renders: the monogram itself blurs into an unreadable blob at 16px
  (normal for any text-based icon at that size, every app degrades
  this way), but the monitor silhouette and gradient stay clearly
  distinct, which is what actually matters for a tray/taskbar icon.
  **`icon.icns` is a known-degraded placeholder** — ImageMagick's icns
  writer only embedded a single 512px layer (35KB) rather than a
  proper multi-resolution bundle like the original MiniDisplay one
  (85KB); not worth fighting further since this project has never
  built or tested on mac (`build:mac` isn't part of this project's
  actual workflow), and Windows' `.ico` — the platform that matters —
  came out properly multi-resolution. **Verified live**: extracted the
  icon actually embedded in the rebuilt, reinstalled `SuperDuperDisplay.exe`
  via `System.Drawing.Icon.ExtractAssociatedIcon` (PowerShell) and
  visually confirmed it's the new monitor+SDD icon, not the old one.
- **README refreshed** to actually describe the current app —
  Sessions 4-9 (the layers canvas, clock/calendar/text/color zones,
  scheduling, hotkeys, theming, undo, config import/export) and this
  session's now-playing/calendar-agenda additions were all missing;
  the file only ever described Phase 1-3. Kept the existing structure
  (tagline, beta banner, feature bullets, "For developers" section)
  rather than restructuring, since only the _content_ was stale, not
  the shape.
- **The aspect-ratio "Fit to content" button's click-through — the
  last unverified item from Session 3 — found a real bug, exactly the
  scenario this file's "verify against the real build, not just the
  underlying mechanism" discipline exists for.** Set up a real test
  (media-plus-stats's zone0 pointed at a freshly generated 4:1-aspect
  test image, real panel content size 1920×480 → predicted
  `computeAutoFitSizes` result `[0.95, 0.05]`, clamped at `MAX_FRAC`),
  navigated the actual control window to Scenes and clicked the real
  DOM button via CDP rather than calling the handler directly. First
  attempt: **the layout sizes didn't change at all.** Traced it by
  reading `zone:getNaturalSize`'s result directly — it returned
  `220×220`, not the test image's real `1600×400`. Root cause, found
  by inspecting the actual display-window DOM: `MediaZone.tsx`
  permanently keeps _two_ `<img>`/`<video>` buffer elements mounted at
  all times for its crossfade-on-file-change behavior (one visible at
  `opacity: 1`, one hidden at `opacity: 0`, matching the same
  dual-buffer technique used for gapless video looping) — but
  `ZoneGetNaturalSize`'s handler in `main/ipc.ts` queried
  `root.querySelector('video, img')`, which deterministically grabs
  whichever buffer is _first in DOM order_, with no regard for which
  one is actually visible. In this real test that was the outgoing
  `cat-jam.gif` (a real 220×220 square GIF this machine's zone0 had
  held before the test), not the incoming test image — so the button
  silently computed a "fit" from a completely different, invisible
  image every time a media zone's file had ever been changed, which
  is: always, since the two-buffer design is permanent, not transient.
  This is almost certainly also _why_ this preset's real layout was
  already sitting at `[0.25, 0.75]` instead of the schema default
  `[0.7, 0.3]` — the user had evidently used this exact button
  successfully on the _original_ load of that same square GIF before
  Session 3's verification gap ever opened. **Fixed**: tagged the
  actually-visible buffer with `data-active={index === activeIndex}`
  in `MediaZone.tsx`, and changed the main-process query to prefer it
  (`querySelector('video[data-active="true"], img[data-active="true"]')`,
  falling back to the old bare `video, img` for zone types — USB/RTSP
  camera — that only ever render one element and never set the
  attribute). Rebuilt, reinstalled, re-ran the identical test:
  `getNaturalSize` now correctly returned `1600×400`, and the real
  button click produced exactly the predicted `[0.95, 0.05]` split.
  Config was restored and re-verified byte-for-byte identical to a
  fresh pre-test backup afterward (including the real `cat-jam.gif`
  zone and the real `[0.25, 0.75]` split this machine actually uses),
  and the app relaunched normally, without the debug port.

### Session 13: mediaCache eviction, a serious git-identity bug fixed, and per-video loop/trim controls

- **`mediaCache` eviction** (the one remaining housekeeping item):
  `main/media/transcode.ts` now caps the cache at 2GB, LRU-evicted —
  a cache hit bumps the file's mtime to "now" (there's no reliable
  last-*accessed*-time signal; NTFS has atime updates disabled by
  default), so mtime doubles as last-used time, and a prune pass after
  each new file is cached deletes oldest-mtime entries first once over
  budget. Not live-tested (would need >2GB of real cached video churn
  to actually trigger eviction) — code review + typecheck/lint only.

- **A serious git-identity bug, found and fixed.** The user spotted
  (via a GitHub web UI screenshot) that every commit in this repo's
  history displayed as authored by their `dezmain` GitHub account,
  not `zedhand` — a standing rule (never use the `dezmain` identity)
  this had silently violated across all 36 commits. Root cause: this
  repo's **local** git `user.email` was set to the user's plain
  personal Gmail address, not their `zedhand`-specific GitHub noreply
  address; the global config already had the correct noreply address,
  but the local override — present since this repo's very first
  commit — took precedence. `git log`/`git config`/`gh auth status`
  all showed `zedhand` as the author *name* and looked completely
  clean, which is exactly what made this easy to miss: GitHub doesn't
  resolve commit authorship by the name string, it resolves the
  *email* against verified GitHub accounts, and that Gmail address
  apparently belongs to the `dezmain` account. Only the actual GitHub
  UI revealed it. Fixed in two parts: (1) removed the local email
  override so it falls back to the correct global noreply address —
  all future commits are unaffected; (2) rewrote all 36 existing
  commits' author/committer email via `git filter-branch --env-filter`
  (stashing this session's uncommitted work first, since filter-branch
  needs a clean tree, then restoring it byte-for-byte afterward) and
  force-pushed to `origin/master` with the user's explicit
  confirmation. Verified: `master`'s full history now shows only the
  correct `zedhand` noreply email, the backup `refs/original/` created
  by filter-branch was cleaned up, and the user confirmed GitHub's UI
  now shows `zedhand` too. A memory was saved on this (verify GitHub's
  *actual* email-based attribution, not just local git metadata, before
  ever declaring a repo's authorship clean).

- **Per-video loop and trim controls**, the user's own follow-up ask
  ("i'd like to have a scrubber and loop setting" for media zones).
  Clarified scope up front rather than guessing at a multi-way
  ambiguity (loop on/off vs. a custom range; scrubber for trim points
  vs. just a preview convenience; editor-only vs. also the live
  preview pane) — user picked: a simple loop on/off toggle, a scrubber
  that sets persisted trim in/out points, Scenes-editor-only.
  - Schema: `media` zone source gained `loop: boolean` (default
    `true`, preserving today's always-loop behavior for every existing
    config) and optional `trimStart`/`trimEnd` (seconds). Single-file
    video only — meaningless for a folder playlist (which rotates
    `item` itself on a timer) or a static image, so the schema fields
    are simply unused/ignored there, the same pattern already used for
    `intervalSec`/`shuffle` only applying to folder mode.
  - `MediaZone.tsx`: the gapless dual-buffer loop swap now seeks to
    `trimStart` (not always `0`) on every restart — the initial mount,
    a genuine file change, and the same-file loop-restart all three
    paths updated — and swaps at `trimEnd` (clamped to the real
    duration) instead of the file's actual end. `loop: false` skips
    the swap entirely: once `currentTime` reaches the effective end,
    the video just pauses and holds that frame, no restart.
  - `ZoneEditors.tsx`'s new `MediaTrimEditor`: an actual `<video>`
    preview loaded via the same app-wide `media://` protocol (so it
    works in the control renderer, not just the display window),
    scrubbed by a real range input bound to the preview's
    `currentTime` — not a fake progress bar — plus "Set start here"/
    "Set end here" buttons that commit the current scrub position as
    `trimStart`/`trimEnd`, a "Clear trim" reset, and the loop checkbox.
    Shown only when a zone's media is a single-file video (gated on
    `source.path && mediaKindFromPath(source.path) === 'video'`).
  - Hit the same `react-hooks/set-state-in-effect` lint rule this
    project has flagged before (Session 6, crossfade transitions):
    the first version reset `duration`/`scrubTime` via a `useEffect`
    keyed on `path`. Fixed with React's own documented pattern for
    "reset state when a prop changes" — `key={source.path}` on
    `<MediaTrimEditor>` so React remounts it fresh on a file change,
    rather than an effect calling `setState`.
  - **Verified live** on the real installed build with a real
    generated test video (10s, on-screen elapsed-seconds text via
    ffmpeg's `drawtext`), polling the active `<video>`'s real
    `currentTime`/`paused` over several seconds rather than trusting
    the code: `loop: true, trimStart: 3, trimEnd: 6` looped cleanly
    between ~3.0–5.9 three times over 8 seconds, never leaving that
    range; `loop: false, trimEnd: 4` played once and paused at ~4.2,
    holding steady for the rest of the poll instead of restarting.
    Also drove the actual Scenes-editor UI via CDP — scrubbed the real
    preview, clicked "Set start here"/"Set end here", and confirmed
    the committed config matched exactly; toggled the loop checkbox
    and confirmed it committed too. (First pass at the UI test
    accidentally grabbed the *Volume* slider instead of the trim
    scrubber — both are bare `<input type="range">` elements on the
    same page — caught immediately since the resulting `trimStart`/
    `trimEnd` came back `0`/`0` instead of the scrubbed values; fixed
    by scoping the selector to the trim editor's own container instead
    of querying the page globally.) Config was restored and
    re-verified byte-for-byte identical to a fresh pre-test backup
    afterward (matching the same additive-field pattern as every prior
    session's new schema field — the real `cat-jam.gif` zone picked up
    `loop: true` since the backup predates the field, everything else
    unchanged), and the app relaunched normally, without the debug
    port.

## Known housekeeping items (low priority, not blocking)

- ~~`mediaCache` (in `userData`) never evicts old entries~~ — fixed in
  Session 13: capped at 2GB, LRU-evicted. See that entry.
- ~~`README.md` was the untouched electron-vite scaffold template with
  a corrupted first line~~ — rewritten to actually describe the app
  (features, dev setup) and matches this user's usual README structure
  (tagline, beta banner, feature bullets, "For developers" section).
- ~~`electron-builder.yml` had the same corruption (`productName`/
  `win.executableName` each a ~33KB line of repeated `y` characters)~~
  — no longer true as of Session 8: the file now has real values
  (`productName: MiniDisplay`, `executableName: MiniDisplay`), and
  Session 8's live-verification builds (`build:win`, real NSIS
  installer, real install) confirmed the installer, shortcut, and
  `.exe` name all come out correct. Unclear exactly when this got
  fixed between Session 7 and now; leaving this note updated rather
  than re-flagging a non-issue. ~~Still worth revisiting `productName`/
  `appId`~~ — done in Session 11's rebrand (`appId:
com.zedhand.superduperdisplay`, `productName: SuperDuperDisplay`).
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
   the existing `SUPERDUPERDISPLAY_AUTO_CAPTURE` block in `src/main/index.ts`
   (which already auto-captures `displayWin` after 1.5s in dev mode) —
   `captureDisplayWindow()` in `src/main/ipc.ts` works on any
   `BrowserWindow`.
3. If the page needs specific config state (e.g. a zone already set to
   a given type), seed `%APPDATA%/superduperdisplay/config.json` directly
   with a full valid `AppConfig` (matches `src/shared/schema.ts`'s
   `appConfigSchema` — check real layout/preset IDs in
   `defaultConfig`, don't guess them).
4. Run `MSYS_NO_PATHCONV=1 SUPERDUPERDISPLAY_AUTO_CAPTURE=1 npm run dev`,
   read the `[debug] control capture: <path>` line from stdout, and
   `Read` the PNG.
5. **Always revert** the two temporary edits and remove any seeded
   `config.json` / capture PNGs afterward — check `git status --short`
   comes back to only the intended feature diff before finishing.

## Full rebrand of remaining identifiers (2026-10-11)

- Finished the rename that the earlier pass deliberately stopped short
  of: the RTSP multipart boundary, the `SUPERDUPERDISPLAY_AUTO_CAPTURE`
  dev env var, the debug-capture temp filename, the `AlertOverlay`
  `@keyframes` names and the `colorProfile.ts` SVG filter id now all use
  `superduperdisplay`.
- The YouTube relay now points at
  `https://zedhand.github.io/superduperdisplay-yt-embed/`. This only works
  once the `minidisplay-yt-embed` repo is renamed to
  `superduperdisplay-yt-embed` and its GitHub Pages site redeploys —
  GitHub Pages does not redirect after a repo rename.
- Kept on purpose: the `minidisplay` legacy-config migration in
  `src/main/store.ts`, which still has to find old installs' config.
- Replaced the stale `buildYoutubeEmbedUrl` test (that function was
  removed when the relay landed) with one covering
  `buildYoutubeEmbedRelayUrl`.
