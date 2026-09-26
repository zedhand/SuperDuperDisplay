import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppConfig, MediaItem } from '@shared/types'

const displayApi = {
  onConfigChanged: (cb: (config: AppConfig) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, config: AppConfig): void => cb(config)
    ipcRenderer.on(IpcChannel.ConfigChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannel.ConfigChanged, listener)
  },
  onMediaFolderChanged: (cb: (folder: string, items: MediaItem[]) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { folder: string; items: MediaItem[] }
    ): void => cb(payload.folder, payload.items)
    ipcRenderer.on(IpcChannel.MediaFolderChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannel.MediaFolderChanged, listener)
  }
}

export type DisplayApi = typeof displayApi

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('display', displayApi)
  } catch (error) {
    console.error(error)
  }
} else {
  window.display = displayApi
}
