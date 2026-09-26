export type Rotation = 0 | 90 | 180 | 270
export type FitMode = 'cover' | 'contain' | 'stretch'
export type ContainBackground = 'solid' | 'blur'
export type DisplayMode = 'live' | 'black' | 'hidden'

export interface DisplayMatch {
  label?: string
  width: number
  height: number
  x?: number
  y?: number
}

export interface DisplayInfo {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  internal: boolean
  isSimulated?: boolean
}

export interface ColorProfile {
  id: string
  name: string
  brightness: number // 0-2, css filter units, 1 = neutral
  contrast: number // 0-2
  saturation: number // 0-2
  hue: number // degrees, -180 to 180
  gamma: number // 0.1-3, 1 = neutral
}

export type ZoneSource =
  | {
      type: 'media'
      path?: string
      folder?: string
      shuffle: boolean
      intervalSec: number
      fit: FitMode
      bg: ContainBackground
      bgColor: string
    }
  | { type: 'youtube'; url: string }
  | { type: 'web'; url: string; css?: string }
  | { type: 'stats'; widgets: string[]; style: 'bars' | 'gauges' | 'compact' }
  | { type: 'camera'; deviceId?: string; rtspUrl?: string }
  | { type: 'blank' }

export interface Layout {
  id: string
  name: string
  split: 'single' | 'h' | 'v' | 'grid'
  sizes: number[] // fractional sizes summing to 1, one per zone
}

export interface Preset {
  id: string
  name: string
  layoutId: string
  zones: Record<string, ZoneSource>
  colorProfileId: string
  fit: FitMode
}

export interface Trigger {
  id: string
  name: string
  metric: 'cpuTemp' | 'gpuTemp' | 'cpuLoad' | 'gpuLoad' | 'vramUsedPct' | 'ramUsedPct'
  op: '>' | '<'
  value: number
  holdSec: number
  clearBelow: number
  effect: { type: 'glow'; color: string } | { type: 'preset'; presetId: string }
}

export interface MediaItem {
  path: string
  name: string
  kind: 'video' | 'image'
  mtimeMs: number
}

export interface Telemetry {
  timestamp: number
  cpuTemp: number | null
  cpuLoad: number | null
  cpuClockMHz: number | null
  gpuTemp: number | null
  gpuLoad: number | null
  gpuClockMHz: number | null
  vramUsedMB: number | null
  vramTotalMB: number | null
  ramUsedMB: number | null
  ramTotalMB: number | null
  source: 'lhm' | 'nvidia-smi' | 'systeminformation' | 'mixed' | 'none'
}

export interface AppConfig {
  version: number
  display: {
    match: DisplayMatch | null
    rotation: Rotation
    simulate: boolean
    mode: DisplayMode
  }
  controlWindow: {
    bounds: { x?: number; y?: number; width: number; height: number } | null
  }
  presets: Preset[]
  activePresetId: string
  layouts: Layout[]
  colorProfiles: ColorProfile[]
  triggers: Trigger[]
  telemetry: {
    source: 'auto' | 'lhm' | 'si'
    lhmUrl: string
    intervalMs: number
  }
  power: {
    blankOnLock: boolean
    blankOnSuspend: boolean
    idleBlankMin: number // 0 = disabled
  }
  remote: {
    enabled: boolean
    port: number
    token: string
  }
  app: {
    launchAtLogin: boolean
    startMinimized: boolean
  }
}

export interface ResolvedZone {
  zoneId: string
  rect: { xPct: number; yPct: number; wPct: number; hPct: number }
  source: ZoneSource
}

export interface Scene {
  presetId: string
  layout: Layout
  zones: ResolvedZone[]
  colorProfile: ColorProfile
  fit: FitMode
}

export interface TriggerState {
  activeTriggerIds: string[]
  effects: Array<Trigger['effect'] & { triggerId: string }>
}
