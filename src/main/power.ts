import { powerMonitor } from 'electron'
import type { AppConfig, DisplayMode } from '@shared/types'

const IDLE_POLL_MS = 15_000

/**
 * Blanks the display on lock/suspend/idle and restores whatever mode was
 * active beforehand once the condition clears. Only ever remembers one
 * saved mode at a time (the first blank reason "wins"); this deliberately
 * doesn't try to distinguish "user manually blanked it while also locked",
 * since Windows blocks interacting with the app while the screen is
 * locked anyway. Blanking to 'black' (not 'hidden') also stops the
 * display renderer's zones from mounting at all — see Stage.tsx's
 * `mode === 'live'` gate — which is what actually stops a playing
 * video's decode/CPU usage while blanked, not just hides it visually.
 */
export class PowerManager {
  private savedMode: DisplayMode | null = null
  private idleTimer: NodeJS.Timeout | null = null
  private getConfig: () => AppConfig
  private setMode: (mode: DisplayMode) => void

  constructor(getConfig: () => AppConfig, setMode: (mode: DisplayMode) => void) {
    this.getConfig = getConfig
    this.setMode = setMode

    powerMonitor.on('lock-screen', () => {
      if (this.getConfig().power.blankOnLock) this.blank()
    })
    powerMonitor.on('suspend', () => {
      if (this.getConfig().power.blankOnSuspend) this.blank()
    })
    powerMonitor.on('unlock-screen', () => this.restore())
    powerMonitor.on('resume', () => this.restore())
  }

  startIdleWatch(): void {
    this.stopIdleWatch()
    this.idleTimer = setInterval(() => this.checkIdle(), IDLE_POLL_MS)
  }

  stopIdleWatch(): void {
    if (this.idleTimer) clearInterval(this.idleTimer)
    this.idleTimer = null
  }

  private checkIdle(): void {
    const config = this.getConfig()
    if (config.power.idleBlankMin <= 0) return
    const idleSec = powerMonitor.getSystemIdleTime()
    const thresholdSec = config.power.idleBlankMin * 60
    if (idleSec >= thresholdSec) {
      this.blank()
    } else if (this.savedMode != null) {
      this.restore()
    }
  }

  private blank(): void {
    const currentMode = this.getConfig().display.mode
    if (this.savedMode == null) this.savedMode = currentMode
    if (currentMode !== 'black') this.setMode('black')
  }

  private restore(): void {
    if (this.savedMode == null) return
    this.setMode(this.savedMode)
    this.savedMode = null
  }
}
