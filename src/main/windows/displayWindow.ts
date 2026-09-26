import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export interface DisplayWindowBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The output window mapped onto the case screen: frameless, non-resizable,
 * click-through, and never focusable, so it can never trap the cursor or
 * steal focus from a game or the desktop.
 */
export function createDisplayWindow(bounds: DisplayWindowBounds): BrowserWindow {
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/display.js'),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      webviewTag: true
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/display/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/display/index.html'))
  }

  win.once('ready-to-show', () => win.showInactive())

  return win
}

export function setDisplayWindowBounds(win: BrowserWindow, bounds: DisplayWindowBounds): void {
  win.setBounds(bounds)
}
