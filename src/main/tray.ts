import { Menu, Tray, type BrowserWindow } from 'electron'
import type { AppConfig, DisplayMode } from '@shared/types'

const MODES: DisplayMode[] = ['live', 'black', 'hidden']

/** Rebuilt on every config change so its preset list and checked mode/preset always match the current state — cheap enough to just throw away and recreate the menu each time. */
export class TrayManager {
  private tray: Tray
  private controlWin: BrowserWindow
  private setActivePreset: (id: string) => void
  private setMode: (mode: DisplayMode) => void
  private onQuit: () => void

  constructor(
    iconPath: string,
    controlWin: BrowserWindow,
    setActivePreset: (id: string) => void,
    setMode: (mode: DisplayMode) => void,
    onQuit: () => void
  ) {
    this.controlWin = controlWin
    this.setActivePreset = setActivePreset
    this.setMode = setMode
    this.onQuit = onQuit
    this.tray = new Tray(iconPath)
    this.tray.setToolTip('MiniDisplay')
    this.tray.on('click', () => this.showControl())
  }

  update(config: AppConfig): void {
    const menu = Menu.buildFromTemplate([
      { label: 'Show MiniDisplay', click: () => this.showControl() },
      { type: 'separator' },
      {
        label: 'Presets',
        submenu: config.presets.map((preset) => ({
          label: preset.name,
          type: 'radio',
          checked: preset.id === config.activePresetId,
          click: () => this.setActivePreset(preset.id)
        }))
      },
      {
        label: 'Mode',
        submenu: MODES.map((mode) => ({
          label: mode[0].toUpperCase() + mode.slice(1),
          type: 'radio',
          checked: config.display.mode === mode,
          click: () => this.setMode(mode)
        }))
      },
      { type: 'separator' },
      { label: 'Quit', click: () => this.onQuit() }
    ])
    this.tray.setContextMenu(menu)
  }

  destroy(): void {
    this.tray.destroy()
  }

  private showControl(): void {
    this.controlWin.show()
    this.controlWin.focus()
  }
}
