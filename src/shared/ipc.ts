import type {
  AppConfig,
  CalendarEvent,
  DisplayInfo,
  DisplayMatch,
  DisplayMode,
  MediaItem,
  NowPlayingInfo,
  RemoteStatus,
  Rotation,
  Scene,
  Telemetry,
  TriggerState
} from './types'

export const IpcChannel = {
  ConfigGet: 'config:get',
  ConfigSet: 'config:set',
  ConfigChanged: 'config:changed',

  SceneActivate: 'scene:activate',
  SceneCurrent: 'scene:current',

  TelemetryTick: 'telemetry:tick',
  NowPlayingTick: 'nowplaying:tick',

  CalendarAgenda: 'calendar:agenda',

  TriggerState: 'trigger:state',

  DisplaysList: 'displays:list',
  DisplaysChanged: 'displays:changed',
  DisplayTarget: 'display:target',
  DisplayMode: 'display:mode',
  DisplayIdentify: 'display:identify',

  MediaPickFolder: 'media:pickFolder',
  MediaPickFile: 'media:pickFile',
  MediaFolderChanged: 'media:folderChanged',

  CameraListDevices: 'camera:listDevices',
  RtspStart: 'rtsp:start',
  RtspStop: 'rtsp:stop',

  RemoteStatus: 'remote:status',
  RemoteSetEnabled: 'remote:setEnabled',
  RemoteRegenerateToken: 'remote:regenerateToken',

  DebugCaptureDisplay: 'debug:captureDisplay',

  ZoneGetNaturalSize: 'zone:getNaturalSize',

  ConfigExport: 'config:export',
  ConfigImport: 'config:import'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

/** invoke() channels: request/response pairs between a renderer and main. */
export interface IpcInvokeMap {
  [IpcChannel.ConfigGet]: { args: []; result: AppConfig }
  [IpcChannel.ConfigSet]: { args: [partial: Partial<AppConfig>]; result: AppConfig }
  [IpcChannel.SceneActivate]: { args: [presetId: string]; result: void }
  [IpcChannel.DisplaysList]: { args: []; result: DisplayInfo[] }
  [IpcChannel.DisplayTarget]: {
    args: [target: { match: DisplayMatch | null; rotation: Rotation; simulate: boolean }]
    result: void
  }
  [IpcChannel.DisplayMode]: { args: [mode: DisplayMode]; result: void }
  [IpcChannel.DisplayIdentify]: { args: []; result: void }
  [IpcChannel.MediaPickFolder]: { args: []; result: string | null }
  [IpcChannel.MediaPickFile]: { args: []; result: string | null }
  [IpcChannel.CameraListDevices]: { args: []; result: void }
  [IpcChannel.RtspStart]: { args: [url: string]; result: { mjpegUrl: string } }
  [IpcChannel.RtspStop]: { args: [url: string]; result: void }
  [IpcChannel.RemoteStatus]: { args: []; result: RemoteStatus }
  [IpcChannel.RemoteSetEnabled]: { args: [enabled: boolean]; result: RemoteStatus }
  [IpcChannel.RemoteRegenerateToken]: { args: []; result: RemoteStatus }
  [IpcChannel.DebugCaptureDisplay]: { args: []; result: { filePath: string } }
  [IpcChannel.ZoneGetNaturalSize]: {
    args: [zoneId: string]
    result: { width: number; height: number } | null
  }
  [IpcChannel.ConfigExport]: { args: []; result: { filePath: string } | null }
  [IpcChannel.ConfigImport]: {
    args: []
    result: { config: AppConfig } | { error: string } | null
  }
  [IpcChannel.CalendarAgenda]: {
    args: [icsUrl: string]
    result: { events: CalendarEvent[]; error?: string }
  }
}

/** One-way broadcast channels: main pushes to a renderer, unprompted. */
export interface IpcBroadcastMap {
  [IpcChannel.ConfigChanged]: AppConfig
  [IpcChannel.SceneCurrent]: Scene
  [IpcChannel.TelemetryTick]: Telemetry
  [IpcChannel.NowPlayingTick]: NowPlayingInfo
  [IpcChannel.TriggerState]: TriggerState
  [IpcChannel.DisplaysChanged]: DisplayInfo[]
  [IpcChannel.MediaFolderChanged]: { folder: string; items: MediaItem[] }
}

export type InvokeChannel = keyof IpcInvokeMap
export type BroadcastChannel = keyof IpcBroadcastMap
