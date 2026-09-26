import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppConfig } from '@shared/types'

const displayApi = {
  onConfigChanged: (cb: (config: AppConfig) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, config: AppConfig): void => cb(config)
    ipcRenderer.on(IpcChannel.ConfigChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannel.ConfigChanged, listener)
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
