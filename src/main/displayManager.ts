import type { BrowserWindow } from 'electron'
import type { AppConfig, DisplayInfo } from '@shared/types'
import { getSimulatorBounds, listDisplays, matchDisplay } from './displays'
import { setDisplayWindowBounds, type DisplayWindowBounds } from './windows/displayWindow'

export interface DisplayTargetResult {
  bounds: DisplayWindowBounds
  isSimulated: boolean
  matchedDisplayId: number | null
}

/** Resolves where the display window should sit, given the current config and connected displays. */
export function resolveDisplayTarget(
  config: AppConfig,
  displays: DisplayInfo[]
): DisplayTargetResult {
  if (!config.display.simulate) {
    const matched = matchDisplay(displays, config.display.match)
    if (matched) {
      return { bounds: matched.bounds, isSimulated: false, matchedDisplayId: matched.id }
    }
  }

  const panelSize = config.display.match
    ? { width: config.display.match.width, height: config.display.match.height }
    : undefined
  return {
    bounds: getSimulatorBounds(displays, panelSize),
    isSimulated: true,
    matchedDisplayId: null
  }
}

/**
 * Keeps the display window positioned on the right physical (or simulated)
 * screen, re-resolving on demand (hot-plug events, config changes, or an
 * explicit retarget request from the control panel).
 */
export class DisplayManager {
  private win: BrowserWindow
  private getConfig: () => AppConfig
  private lastResult: DisplayTargetResult | null = null

  constructor(win: BrowserWindow, getConfig: () => AppConfig) {
    this.win = win
    this.getConfig = getConfig
  }

  retarget(): DisplayTargetResult {
    const result = resolveDisplayTarget(this.getConfig(), listDisplays())
    setDisplayWindowBounds(this.win, result.bounds)
    this.lastResult = result
    return result
  }

  /** 'hidden' actually hides the BrowserWindow, so the panel behaves like a normal extended monitor underneath; 'live'/'black' just show it (content is decided by the renderer). */
  applyMode(mode: AppConfig['display']['mode']): void {
    if (mode === 'hidden') {
      this.win.hide()
    } else if (!this.win.isVisible()) {
      this.win.showInactive()
    }
  }

  getLastResult(): DisplayTargetResult | null {
    return this.lastResult
  }

  listDisplaysWithTargetFlag(): Array<DisplayInfo & { isTarget: boolean; isSimulated?: boolean }> {
    const displays = listDisplays()
    const targetId = this.lastResult?.matchedDisplayId ?? null
    return displays.map((d) => ({ ...d, isTarget: d.id === targetId }))
  }
}
