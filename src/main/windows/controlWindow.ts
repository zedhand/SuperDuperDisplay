import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { AppConfig } from '@shared/types'

export function createControlWindow(config: AppConfig): BrowserWindow {
  const bounds = config.controlWindow.bounds

  const win = new BrowserWindow({
    x: bounds?.x,
    y: bounds?.y,
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b0f',
    webPreferences: {
      preload: join(__dirname, '../preload/control.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => {
    if (!config.app.startMinimized) win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/control/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/control/index.html'))
  }

  return win
}
