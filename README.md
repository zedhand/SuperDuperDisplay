# MiniDisplay

**Driver app for a case-mounted secondary display.**

> 🚧 **Pre-release.** Every feature described below is built and working, but this hasn't been
> through a real first test release yet — see [`PLAN.md`](PLAN.md) for current status.

## What it is

An Electron app that turns a spare panel — a case-mounted screen, an old monitor, whatever's
bolted to the side of the rig — into a live secondary display, driven from a control window on
your main monitor. The display window targets whichever screen you point it at (by resolution
match or manual pick), and a simulate mode lets you preview layouts without a second screen
plugged in at all.

Content is arranged into resizable zones on a layout, and each zone shows one of:

- **Local media** — a single file or a folder playlist, with shuffle, timed rotation, and
  seamless looping
- **YouTube** or an arbitrary **web page/dashboard**, embedded
- **Live hardware telemetry** — CPU/GPU temp, load, clock, VRAM, RAM — via LibreHardwareMonitor,
  `nvidia-smi`, or `systeminformation`, rendered as bars, gauges, or a compact readout
- **A camera feed** — a USB webcam via `getUserMedia`, or an RTSP camera bridged through ffmpeg
  into something Chromium can actually display

## What it does for you

**🎨 Layout & color** — Drag-to-resize zones on a layout, and a full color-correction pipeline
(brightness/contrast/saturation/hue/gamma) per profile, so the panel looks right regardless of
what it's mounted next to.

**🌡️ Triggers** — React to a metric crossing a threshold (GPU temp, CPU load, etc.) with a
pulsing glow overlay or an automatic preset switch — with hold time and hysteresis so a trigger
doesn't flap on and off at the edge of its threshold.

**🔌 Power-aware** — Syncs with Windows lock/suspend/idle so the display blanks itself when you
step away, instead of burning in a frozen frame.

**🗂️ Tray-first** — Lives in the system tray with quick preset/mode switching, minimize-to-tray,
and launch-at-login, so it's just running whenever the machine is.

**📱 LAN remote** — A small QR-code-paired web remote, served over your local network, to switch
presets or blank/unblank the display from a phone without walking back to the desk. Not exposed
to the internet, and gated behind a token that regenerates on demand.

## For developers

MiniDisplay is an Electron app written in TypeScript, with a dual-window architecture: a control
window (React, runs on your main monitor) and a display window (the actual output, targeted at
the secondary panel).

- **UI:** React + Tailwind, two separate renderer bundles (`control`, `display`) sharing types
  from `src/shared`
- **Main process:** display targeting/matching, config persistence (`electron-store`), hardware
  telemetry polling, a trigger engine, Windows power-event sync, system tray, an RTSP→MJPEG bridge
  (ffmpeg), and a LAN remote server (`express` + `ws`)
- **IPC:** a typed channel contract in `src/shared/ipc.ts` shared between main and both preload
  scripts, so a renderer's `window.control`/`window.display` calls are type-checked end to end
- **Build:** `electron-vite`, `electron-builder`

### Building

```bash
npm install
npm run dev          # run in development
npm run build:win     # production build + installer (also :mac, :linux)
```

### Testing

```bash
npm run typecheck    # tsc, both the node and web tsconfigs
npm run lint         # eslint
npm test             # vitest
```

## License

All rights reserved.
