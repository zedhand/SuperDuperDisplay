import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
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
import { FolderSyncManager } from './media/folderSync'
import { TelemetryService } from './telemetry'
import { NowPlayingService } from './media/nowPlaying'
import { TriggerEngine } from './triggerEngine'
import { Scheduler } from './scheduler'
import { PowerManager } from './power'
import { TrayManager } from './tray'
import { RtspManager } from './camera/rtsp'
import { RemoteServer } from './remote/server'
import { registerMediaPermissions, registerWebviewHardening } from './webSecurity'
import { unregisterHotkeys } from './hotkeys'
import { IpcChannel } from '@shared/ipc'

registerMediaProtocolScheme()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let controlWin: BrowserWindow | null = null
  let isQuitting = false

  app.on('second-instance', () => {
    if (controlWin) {
      if (controlWin.isMinimized()) controlWin.restore()
      controlWin.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.zedhand.superduperdisplay')
    registerMediaProtocolHandler()
    registerMediaPermissions()
    registerWebviewHardening()

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    const config = getConfig()
    if (!config.controlWindow.bounds) {
      config.controlWindow.bounds = getDefaultControlWindowBounds(listDisplays())
    }
    app.setLoginItemSettings({ openAtLogin: config.app.launchAtLogin })

    controlWin = createControlWindow(config)
    const initialBounds = getSimulatorBounds(listDisplays(), config.display.match ?? undefined)
    const displayWin = createDisplayWindow(initialBounds)

    const displayManager = new DisplayManager(displayWin, getConfig)
    displayManager.retarget()
    displayManager.applyMode(config.display.mode)

    const folderSyncManager = new FolderSyncManager((folder, items) => {
      displayWin.webContents.send(IpcChannel.MediaFolderChanged, { folder, items })
    })

    // `ctx` is captured by the callbacks below before it's assigned, but not
    // read until they actually run (async ticks), by which point it's set.
    // eslint-disable-next-line prefer-const
    let ctx: Parameters<typeof registerIpcHandlers>[0]

    const triggerEngine = new TriggerEngine(
      (state) => displayWin.webContents.send(IpcChannel.TriggerState, state),
      (presetId) => {
        const next = setConfig({ activePresetId: presetId })
        broadcastConfig(ctx, next)
      }
    )

    const telemetryService = new TelemetryService((telemetry) => {
      displayWin.webContents.send(IpcChannel.TelemetryTick, telemetry)
      controlWin?.webContents.send(IpcChannel.TelemetryTick, telemetry)
      triggerEngine.evaluate(getConfig().triggers, telemetry)
    })
    telemetryService.start(config.telemetry)

    const nowPlayingService = new NowPlayingService((info) => {
      displayWin.webContents.send(IpcChannel.NowPlayingTick, info)
    })
    nowPlayingService.start()

    const scheduler = new Scheduler(
      () => getConfig().schedule,
      (presetId) => broadcastConfig(ctx, setConfig({ activePresetId: presetId }))
    )
    scheduler.start()

    const trayManager = new TrayManager(
      join(__dirname, '../../resources/icon.png'),
      controlWin,
      (presetId) => broadcastConfig(ctx, setConfig({ activePresetId: presetId })),
      (mode) => {
        const next = setConfig({ display: { ...getConfig().display, mode } })
        displayManager.applyMode(mode)
        broadcastConfig(ctx, next)
      },
      () => {
        isQuitting = true
        app.quit()
      }
    )
    trayManager.update(config)

    const rtspManager = new RtspManager()

    const remoteServer = new RemoteServer(
      getConfig,
      (presetId) => broadcastConfig(ctx, setConfig({ activePresetId: presetId })),
      (mode) => {
        const next = setConfig({ display: { ...getConfig().display, mode } })
        displayManager.applyMode(mode)
        broadcastConfig(ctx, next)
      }
    )
    remoteServer.applyConfig(config.remote).catch((err: Error) => {
      console.error('[remote] failed to start on launch:', err.message)
    })

    ctx = {
      controlWin,
      displayWin,
      displayManager,
      folderSyncManager,
      telemetryService,
      trayManager,
      rtspManager,
      remoteServer
    }
    registerIpcHandlers(ctx)

    const powerManager = new PowerManager(getConfig, (mode) => {
      const next = setConfig({ display: { ...getConfig().display, mode } })
      displayManager.applyMode(mode)
      broadcastConfig(ctx, next)
    })
    powerManager.startIdleWatch()

    displayWin.webContents.once('did-finish-load', () => broadcastConfig(ctx, getConfig()))
    controlWin.webContents.once('did-finish-load', () => broadcastConfig(ctx, getConfig()))

    if (is.dev && process.env['SUPERDUPERDISPLAY_AUTO_CAPTURE']) {
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
    controlWin.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault()
        controlWin?.hide()
      }
    })

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

    app.on('before-quit', () => {
      isQuitting = true
      folderSyncManager.stopAll()
      telemetryService.stop()
      nowPlayingService.stop()
      powerManager.stopIdleWatch()
      trayManager.destroy()
      rtspManager.stopAll()
      remoteServer.stop()
      unregisterHotkeys()
      scheduler.stop()
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
