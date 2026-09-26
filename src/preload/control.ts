import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppConfig, DisplayInfo, DisplayMatch, DisplayMode, Rotation } from '@shared/types'

const controlApi = {
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke(IpcChannel.ConfigGet),
    set: (patch: Partial<AppConfig>): Promise<AppConfig> =>
      ipcRenderer.invoke(IpcChannel.ConfigSet, patch),
    onChanged: (cb: (config: AppConfig) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, config: AppConfig): void => cb(config)
      ipcRenderer.on(IpcChannel.ConfigChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannel.ConfigChanged, listener)
    }
  },
  displays: {
    list: (): Promise<Array<DisplayInfo & { isTarget: boolean }>> =>
      ipcRenderer.invoke(IpcChannel.DisplaysList),
    setTarget: (target: {
      match: DisplayMatch | null
      rotation: Rotation
      simulate: boolean
    }): Promise<void> => ipcRenderer.invoke(IpcChannel.DisplayTarget, target),
    setMode: (mode: DisplayMode): Promise<void> => ipcRenderer.invoke(IpcChannel.DisplayMode, mode),
    identify: (): Promise<void> => ipcRenderer.invoke(IpcChannel.DisplayIdentify),
    onChanged: (
      cb: (displays: Array<DisplayInfo & { isTarget: boolean }>) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        displays: Array<DisplayInfo & { isTarget: boolean }>
      ): void => cb(displays)
      ipcRenderer.on(IpcChannel.DisplaysChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannel.DisplaysChanged, listener)
    }
  },
  media: {
    pickFile: (): Promise<string | null> => ipcRenderer.invoke(IpcChannel.MediaPickFile),
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IpcChannel.MediaPickFolder)
  },
  debug: {
    captureDisplay: (): Promise<{ filePath: string }> =>
      ipcRenderer.invoke(IpcChannel.DebugCaptureDisplay)
  }
}

export type ControlApi = typeof controlApi

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('control', controlApi)
  } catch (error) {
    console.error(error)
  }
} else {
  window.control = controlApi
}
