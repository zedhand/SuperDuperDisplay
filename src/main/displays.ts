import { screen, type Display } from 'electron'
import type { DisplayInfo, DisplayMatch } from '@shared/types'

/** Known case-screen resolutions we auto-detect when no saved match exists yet, in either orientation. */
const CASE_SCREEN_SIZES: Array<{ width: number; height: number }> = [
  { width: 1920, height: 480 },
  { width: 1024, height: 600 },
  { width: 320, height: 1480 }
]

export function toDisplayInfo(display: Display): DisplayInfo {
  const physicalWidth = Math.round(display.bounds.width * display.scaleFactor)
  const physicalHeight = Math.round(display.bounds.height * display.scaleFactor)
  return {
    id: display.id,
    label:
      display.label && display.label.length > 0
        ? display.label
        : `${physicalWidth}x${physicalHeight} @ (${display.bounds.x},${display.bounds.y})`,
    bounds: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: physicalWidth,
      height: physicalHeight
    },
    scaleFactor: display.scaleFactor,
    internal: display.internal ?? false
  }
}

export function listDisplays(): DisplayInfo[] {
  return screen.getAllDisplays().map(toDisplayInfo)
}

function sizeMatches(info: DisplayInfo, width: number, height: number): boolean {
  return (
    (info.bounds.width === width && info.bounds.height === height) ||
    (info.bounds.width === height && info.bounds.height === width)
  )
}

export function findCaseScreenCandidates(displays: DisplayInfo[]): DisplayInfo[] {
  return displays.filter((d) => CASE_SCREEN_SIZES.some((s) => sizeMatches(d, s.width, s.height)))
}

/**
 * Resolves a saved DisplayMatch to a currently-connected display. Windows
 * display ids aren't stable across reboots/hotplugs, so matching goes:
 * exact position+size -> size only (screen moved to a different port) ->
 * any display that looks like a known case-screen resolution -> none.
 */
export function matchDisplay(
  displays: DisplayInfo[],
  match: DisplayMatch | null
): DisplayInfo | null {
  if (match) {
    const exact = displays.find(
      (d) =>
        d.bounds.width === match.width &&
        d.bounds.height === match.height &&
        (match.x == null || d.bounds.x === match.x) &&
        (match.y == null || d.bounds.y === match.y)
    )
    if (exact) return exact

    const sizeOnly = displays.find(
      (d) => d.bounds.width === match.width && d.bounds.height === match.height
    )
    if (sizeOnly) return sizeOnly
  }

  return findCaseScreenCandidates(displays)[0] ?? null
}

export function displayMatchFromInfo(info: DisplayInfo): DisplayMatch {
  return {
    label: info.label,
    width: info.bounds.width,
    height: info.bounds.height,
    x: info.bounds.x,
    y: info.bounds.y
  }
}

/**
 * The largest non-primary display, or the primary display if there's only
 * one screen. Both the simulator and the first-run control window default
 * to this host, so neither ever pops up uninvited on top of whatever the
 * user actually has on their main/primary monitor.
 */
export function pickNonPrimaryHost(displays: DisplayInfo[]): DisplayInfo {
  const primaryDisplay = screen.getPrimaryDisplay()
  const nonPrimary = displays.filter((d) => d.id !== primaryDisplay.id)
  if (nonPrimary.length > 0) {
    return nonPrimary.reduce((a, b) =>
      a.bounds.width * a.bounds.height >= b.bounds.width * b.bounds.height ? a : b
    )
  }
  return displays.find((d) => d.id === primaryDisplay.id) ?? toDisplayInfo(primaryDisplay)
}

/** Default simulator panel size, used until a real match narrows it. */
const DEFAULT_SIM_SIZE = { width: 1920, height: 480 }

/**
 * Bounds for the built-in simulated case screen: a borderless window sized
 * like the target panel, docked in the bottom-left corner of its host
 * display. The size is clamped to fit within the host.
 */
export function getSimulatorBounds(
  displays: DisplayInfo[],
  panelSize: { width: number; height: number } = DEFAULT_SIM_SIZE
): { x: number; y: number; width: number; height: number } {
  const host = pickNonPrimaryHost(displays)
  const width = Math.min(panelSize.width, host.bounds.width)
  const height = Math.min(panelSize.height, host.bounds.height)

  return {
    x: host.bounds.x,
    y: host.bounds.y + host.bounds.height - height,
    width,
    height
  }
}

/**
 * Default control-window placement for a fresh install (no saved bounds
 * yet): centered on the same non-primary host as the simulator, so on
 * first launch both windows land together, off the user's primary monitor.
 */
export function getDefaultControlWindowBounds(
  displays: DisplayInfo[],
  size: { width: number; height: number } = { width: 1280, height: 800 }
): { x: number; y: number; width: number; height: number } {
  const host = pickNonPrimaryHost(displays)
  const width = Math.min(size.width, host.bounds.width)
  const height = Math.min(size.height, host.bounds.height)

  return {
    x: host.bounds.x + Math.round((host.bounds.width - width) / 2),
    y: host.bounds.y + Math.round((host.bounds.height - height) / 2),
    width,
    height
  }
}
