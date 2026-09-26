import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppConfig, MediaItem, Telemetry, TriggerState } from '@shared/types'

const displayApi = {
  onConfigChanged: (cb: (config: AppConfig) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, config: AppConfig): void => cb(config)
    ipcRenderer.on(IpcChannel.ConfigChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannel.ConfigChanged, listener)
  },
  onTelemetry: (cb: (telemetry: Telemetry) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, telemetry: Telemetry): void =>
      cb(telemetry)
    ipcRenderer.on(IpcChannel.TelemetryTick, listener)
    return () => ipcRenderer.removeListener(IpcChannel.TelemetryTick, listener)
  },
  onMediaFolderChanged: (cb: (folder: string, items: MediaItem[]) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { folder: string; items: MediaItem[] }
    ): void => cb(payload.folder, payload.items)
    ipcRenderer.on(IpcChannel.MediaFolderChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannel.MediaFolderChanged, listener)
  },
  onTriggerState: (cb: (state: TriggerState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: TriggerState): void => cb(state)
    ipcRenderer.on(IpcChannel.TriggerState, listener)
    return () => ipcRenderer.removeListener(IpcChannel.TriggerState, listener)
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
