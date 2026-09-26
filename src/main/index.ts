import { app, BrowserWindow, screen } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getConfig, setConfig } from './store'
import { createControlWindow } from './windows/controlWindow'
import { createDisplayWindow } from './windows/displayWindow'
import { DisplayManager } from './displayManager'
import { getDefaultControlWindowBounds, getSimulatorBounds, listDisplays } from './displays'
import {
  broadcastConfig,
  broadcastDisplays,
  captureDisplayWindow,
  registerIpcHandlers
} from './ipc'
import { registerMediaProtocolHandler, registerMediaProtocolScheme } from './protocol'

registerMediaProtocolScheme()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let controlWin: BrowserWindow | null = null

  app.on('second-instance', () => {
    if (controlWin) {
      if (controlWin.isMinimized()) controlWin.restore()
      controlWin.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.zedhand.minidisplay')
    registerMediaProtocolHandler()

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    const config = getConfig()
    if (!config.controlWindow.bounds) {
      config.controlWindow.bounds = getDefaultControlWindowBounds(listDisplays())
    }

    controlWin = createControlWindow(config)
    const initialBounds = getSimulatorBounds(listDisplays(), config.display.match ?? undefined)
    const displayWin = createDisplayWindow(initialBounds)

    const displayManager = new DisplayManager(displayWin, getConfig)
    displayManager.retarget()
    displayManager.applyMode(config.display.mode)

    const ctx = { controlWin, displayWin, displayManager }
    registerIpcHandlers(ctx)

    displayWin.webContents.once('did-finish-load', () => broadcastConfig(ctx, getConfig()))
    controlWin.webContents.once('did-finish-load', () => broadcastConfig(ctx, getConfig()))

    if (is.dev && process.env['MINIDISPLAY_AUTO_CAPTURE']) {
      displayWin.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          captureDisplayWindow(displayWin).then(({ filePath }) =>
            console.log('[debug] display capture:', filePath)
          )
        }, 1500)
      })
    }

    controlWin.on('resized', () => persistControlWindowBounds(controlWin!))
    controlWin.on('moved', () => persistControlWindowBounds(controlWin!))

    const retarget = (): void => {
      displayManager.retarget()
      broadcastDisplays(ctx)
    }
    screen.on('display-added', retarget)
    screen.on('display-removed', retarget)
    screen.on('display-metrics-changed', retarget)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        controlWin = createControlWindow(getConfig())
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

function persistControlWindowBounds(win: BrowserWindow): void {
  const bounds = win.getBounds()
  setConfig({ controlWindow: { bounds } })
}
