import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { ZodError } from 'zod'
import { IpcChannel } from '@shared/ipc'
import type { AppConfig } from '@shared/types'
import { getActiveMediaFolders } from '@shared/layout'
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '@shared/media'
import { getConfig, replaceConfig, setConfig } from './store'
import { updateHotkeys } from './hotkeys'
import type { DisplayManager } from './displayManager'
import type { FolderSyncManager } from './media/folderSync'
import type { TelemetryService } from './telemetry'
import type { TrayManager } from './tray'
import type { RtspManager } from './camera/rtsp'
import { generateRemoteToken, type RemoteServer } from './remote/server'
import { getAgenda } from './calendar/ics'

export interface IpcContext {
  controlWin: BrowserWindow
  displayWin: BrowserWindow
  displayManager: DisplayManager
  folderSyncManager: FolderSyncManager
  telemetryService: TelemetryService
  trayManager: TrayManager
  rtspManager: RtspManager
  remoteServer: RemoteServer
}

export function broadcastConfig(ctx: IpcContext, config: AppConfig): void {
  ctx.controlWin.webContents.send(IpcChannel.ConfigChanged, config)
  ctx.displayWin.webContents.send(IpcChannel.ConfigChanged, config)
  ctx.folderSyncManager.setActiveFolders(getActiveMediaFolders(config))
  ctx.trayManager.update(config)
  ctx.remoteServer.broadcastState(config)
  updateHotkeys(
    config,
    (presetId) => broadcastConfig(ctx, setConfig({ activePresetId: presetId })),
    (mode) => {
      ctx.displayManager.applyMode(mode)
      broadcastConfig(ctx, setConfig({ display: { ...getConfig().display, mode } }))
    }
  )
}

export function broadcastDisplays(ctx: IpcContext): void {
  ctx.controlWin.webContents.send(
    IpcChannel.DisplaysChanged,
    ctx.displayManager.listDisplaysWithTargetFlag()
  )
}

export function registerIpcHandlers(ctx: IpcContext): void {
  ipcMain.handle(IpcChannel.ConfigGet, () => getConfig())

  ipcMain.handle(IpcChannel.ConfigSet, async (_event, patch: Partial<AppConfig>) => {
    const next = setConfig(patch)
    if (patch.display) {
      ctx.displayManager.retarget()
      ctx.displayManager.applyMode(next.display.mode)
    }
    if (patch.telemetry) {
      ctx.telemetryService.start(next.telemetry)
    }
    if (patch.app) {
      app.setLoginItemSettings({ openAtLogin: next.app.launchAtLogin })
    }
    if (patch.remote) {
      await ctx.remoteServer.applyConfig(next.remote)
    }
    broadcastConfig(ctx, next)
    return next
  })

  ipcMain.handle(IpcChannel.DisplaysList, () => ctx.displayManager.listDisplaysWithTargetFlag())

  ipcMain.handle(
    IpcChannel.DisplayTarget,
    (
      _event,
      target: {
        match: AppConfig['display']['match']
        rotation: AppConfig['display']['rotation']
        simulate: boolean
      }
    ) => {
      const next = setConfig({ display: { ...getConfig().display, ...target } })
      ctx.displayManager.retarget()
      broadcastConfig(ctx, next)
      broadcastDisplays(ctx)
    }
  )

  ipcMain.handle(IpcChannel.DisplayMode, (_event, mode: AppConfig['display']['mode']) => {
    const next = setConfig({ display: { ...getConfig().display, mode } })
    ctx.displayManager.applyMode(mode)
    broadcastConfig(ctx, next)
  })

  ipcMain.handle(IpcChannel.DisplayIdentify, async () => {
    const flashCss = `
      (() => {
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;inset:0;background:#ff2fd0;z-index:999999;';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 900);
      })();
    `
    await ctx.displayWin.webContents.executeJavaScript(flashCss)
  })

  ipcMain.handle(IpcChannel.DebugCaptureDisplay, () => captureDisplayWindow(ctx.displayWin))

  ipcMain.handle(IpcChannel.ZoneGetNaturalSize, async (_event, zoneId: string) => {
    const script = `
      (function() {
        const root = document.querySelector('[data-zone-id="' + CSS.escape(${JSON.stringify(zoneId)}) + '"]');
        // A media zone permanently keeps two <video>/<img> buffers in the DOM for
        // crossfading (MediaZone.tsx) — 'video, img' alone would nondeterministically
        // grab whichever buffer happens to be first in DOM order, not necessarily the
        // one actually visible. Prefer the one MediaZone tags as active; other zone
        // types (camera) only ever render one element, so the fallback still covers them.
        const el = root && (root.querySelector('video[data-active="true"], img[data-active="true"]') || root.querySelector('video, img'));
        if (!el) return null;
        if (el.tagName === 'VIDEO') {
          return el.videoWidth && el.videoHeight ? { width: el.videoWidth, height: el.videoHeight } : null;
        }
        return el.naturalWidth && el.naturalHeight ? { width: el.naturalWidth, height: el.naturalHeight } : null;
      })()
    `
    return ctx.displayWin.webContents.executeJavaScript(script)
  })

  ipcMain.handle(IpcChannel.CalendarAgenda, (_event, icsUrl: string) => getAgenda(icsUrl))

  ipcMain.handle(IpcChannel.ConfigExport, async () => {
    const result = await dialog.showSaveDialog(ctx.controlWin, {
      defaultPath: 'superduperdisplay-config.json',
      filters: [{ name: 'SuperDuperDisplay config', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    // Includes remote.token as-is (needed to actually restore remote access
    // on import) — the control UI warns before export that this file should
    // be treated like a password if shared.
    await writeFile(result.filePath, JSON.stringify(getConfig(), null, 2), 'utf8')
    return { filePath: result.filePath }
  })

  ipcMain.handle(IpcChannel.ConfigImport, async () => {
    const result = await dialog.showOpenDialog(ctx.controlWin, {
      properties: ['openFile'],
      filters: [{ name: 'SuperDuperDisplay config', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    try {
      const raw = await readFile(result.filePaths[0], 'utf8')
      const next = replaceConfig(JSON.parse(raw))
      ctx.displayManager.retarget()
      ctx.displayManager.applyMode(next.display.mode)
      await ctx.remoteServer.applyConfig(next.remote)
      broadcastConfig(ctx, next)
      return { config: next }
    } catch (err) {
      const message =
        err instanceof ZodError
          ? `Not a valid SuperDuperDisplay config: ${err.issues[0]?.message ?? 'schema mismatch'}`
          : `Couldn't read that file: ${(err as Error).message}`
      return { error: message }
    }
  })

  ipcMain.handle(IpcChannel.MediaPickFile, async () => {
    const result = await dialog.showOpenDialog(ctx.controlWin, {
      properties: ['openFile'],
      filters: [{ name: 'Media', extensions: [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS] }]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle(IpcChannel.MediaPickFolder, async () => {
    const result = await dialog.showOpenDialog(ctx.controlWin, { properties: ['openDirectory'] })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle(IpcChannel.RtspStart, (_event, url: string) => ctx.rtspManager.start(url))

  ipcMain.handle(IpcChannel.RtspStop, (_event, url: string) => {
    ctx.rtspManager.stop(url)
  })

  ipcMain.handle(IpcChannel.RemoteStatus, () => ctx.remoteServer.status())

  ipcMain.handle(IpcChannel.RemoteSetEnabled, async (_event, enabled: boolean) => {
    const current = getConfig()
    const token = enabled && !current.remote.token ? generateRemoteToken() : current.remote.token
    const next = setConfig({ remote: { ...current.remote, enabled, token } })
    await ctx.remoteServer.applyConfig(next.remote)
    broadcastConfig(ctx, next)
    return ctx.remoteServer.status()
  })

  ipcMain.handle(IpcChannel.RemoteRegenerateToken, async () => {
    const current = getConfig()
    const next = setConfig({ remote: { ...current.remote, token: generateRemoteToken() } })
    await ctx.remoteServer.applyConfig(next.remote)
    broadcastConfig(ctx, next)
    return ctx.remoteServer.status()
  })
}

export async function captureDisplayWindow(win: BrowserWindow): Promise<{ filePath: string }> {
  const image = await win.webContents.capturePage()
  const filePath = join(app.getPath('temp'), `superduperdisplay-capture-${Date.now()}.png`)
  await writeFile(filePath, image.toPNG())
  return { filePath }
}
