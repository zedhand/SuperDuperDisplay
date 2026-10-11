import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type {
  AppConfig,
  CalendarEvent,
  FeedItem,
  DisplayInfo,
  DisplayMatch,
  DisplayMode,
  RemoteStatus,
  Rotation,
  Telemetry,
  WeatherReport
} from '@shared/types'

const controlApi = {
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke(IpcChannel.ConfigGet),
    set: (patch: Partial<AppConfig>): Promise<AppConfig> =>
      ipcRenderer.invoke(IpcChannel.ConfigSet, patch),
    onChanged: (cb: (config: AppConfig) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, config: AppConfig): void => cb(config)
      ipcRenderer.on(IpcChannel.ConfigChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannel.ConfigChanged, listener)
    },
    export: (): Promise<{ filePath: string } | null> => ipcRenderer.invoke(IpcChannel.ConfigExport),
    import: (): Promise<{ config: AppConfig } | { error: string } | null> =>
      ipcRenderer.invoke(IpcChannel.ConfigImport)
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
  telemetry: {
    onTick: (cb: (telemetry: Telemetry) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, telemetry: Telemetry): void =>
        cb(telemetry)
      ipcRenderer.on(IpcChannel.TelemetryTick, listener)
      return () => ipcRenderer.removeListener(IpcChannel.TelemetryTick, listener)
    }
  },
  remote: {
    status: (): Promise<RemoteStatus> => ipcRenderer.invoke(IpcChannel.RemoteStatus),
    setEnabled: (enabled: boolean): Promise<RemoteStatus> =>
      ipcRenderer.invoke(IpcChannel.RemoteSetEnabled, enabled),
    regenerateToken: (): Promise<RemoteStatus> =>
      ipcRenderer.invoke(IpcChannel.RemoteRegenerateToken)
  },
  debug: {
    captureDisplay: (): Promise<{ filePath: string }> =>
      ipcRenderer.invoke(IpcChannel.DebugCaptureDisplay)
  },
  zone: {
    getNaturalSize: (zoneId: string): Promise<{ width: number; height: number } | null> =>
      ipcRenderer.invoke(IpcChannel.ZoneGetNaturalSize, zoneId)
  },
  calendar: {
    getAgenda: (icsUrl: string): Promise<{ events: CalendarEvent[]; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.CalendarAgenda, icsUrl)
  },
  weather: {
    get: (
      location: string,
      units: 'metric' | 'imperial'
    ): Promise<{ report: WeatherReport | null; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.WeatherGet, location, units)
  },
  rss: {
    get: (feedUrl: string): Promise<{ title: string; items: FeedItem[]; error?: string }> =>
      ipcRenderer.invoke(IpcChannel.RssGet, feedUrl)
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
