import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { IpcChannel } from '@shared/ipc'
import type { AppConfig } from '@shared/types'
import { getActiveMediaFolders } from '@shared/layout'
import { getConfig, setConfig } from './store'
import type { DisplayManager } from './displayManager'
import type { FolderSyncManager } from './media/folderSync'

export interface IpcContext {
  controlWin: BrowserWindow
  displayWin: BrowserWindow
  displayManager: DisplayManager
  folderSyncManager: FolderSyncManager
}

export function broadcastConfig(ctx: IpcContext, config: AppConfig): void {
  ctx.controlWin.webContents.send(IpcChannel.ConfigChanged, config)
  ctx.displayWin.webContents.send(IpcChannel.ConfigChanged, config)
  ctx.folderSyncManager.setActiveFolders(getActiveMediaFolders(config))
}

export function broadcastDisplays(ctx: IpcContext): void {
  ctx.controlWin.webContents.send(
    IpcChannel.DisplaysChanged,
    ctx.displayManager.listDisplaysWithTargetFlag()
  )
}

export function registerIpcHandlers(ctx: IpcContext): void {
  ipcMain.handle(IpcChannel.ConfigGet, () => getConfig())

  ipcMain.handle(IpcChannel.ConfigSet, (_event, patch: Partial<AppConfig>) => {
    const next = setConfig(patch)
    if (patch.display) {
      ctx.displayManager.retarget()
      ctx.displayManager.applyMode(next.display.mode)
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

  ipcMain.handle(IpcChannel.MediaPickFile, async () => {
    const result = await dialog.showOpenDialog(ctx.controlWin, {
      properties: ['openFile'],
      filters: [{ name: 'Media', extensions: ['mp4', 'webm', 'gif', 'png', 'jpg', 'jpeg'] }]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle(IpcChannel.MediaPickFolder, async () => {
    const result = await dialog.showOpenDialog(ctx.controlWin, { properties: ['openDirectory'] })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
}

export async function captureDisplayWindow(win: BrowserWindow): Promise<{ filePath: string }> {
  const image = await win.webContents.capturePage()
  const filePath = join(app.getPath('temp'), `minidisplay-capture-${Date.now()}.png`)
  await writeFile(filePath, image.toPNG())
  return { filePath }
}
