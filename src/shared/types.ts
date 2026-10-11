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
      volume: number // 0-1, defaults to 0 (muted) — this is an ambient display, not a sound source
      loop: boolean // single-file video only; defaults to true (today's always-loop behavior). false plays once and holds the last frame.
      trimStart?: number // seconds; single-file video only. Where playback/looping starts — skips a slow intro without re-encoding the file.
      trimEnd?: number // seconds; single-file video only. Where playback/looping ends, so a loop can cover just a highlight instead of the whole file.
    }
  | { type: 'youtube'; url: string; volume: number } // 0-1, defaults to 0
  | { type: 'web'; url: string; css?: string; volume: number } // 0-1, defaults to 0; a webview can only be muted/unmuted (0 vs >0), not set to a partial level
  | { type: 'stats'; widgets: string[]; style: 'bars' | 'gauges' | 'compact' }
  | { type: 'camera'; deviceId?: string; rtspUrl?: string }
  | {
      type: 'clock'
      format: '12h' | '24h'
      showDate: boolean
      color: string
      align: 'left' | 'center' | 'right'
    }
  | { type: 'calendar'; accentColor: string; mode: 'grid' | 'agenda'; icsUrl?: string } // 'grid': local month grid, no account integration. 'agenda': upcoming events from a subscribed .ics feed URL (Google/Outlook/Apple "secret address" export or any public .ics link) — no OAuth, no stored account credentials.
  | {
      type: 'weather'
      location: string // a place name (geocoded via Open-Meteo, no API key) or "lat,lon"
      units: 'metric' | 'imperial'
      color: string
      showForecast: boolean
    }
  | {
      type: 'rss'
      feedUrl: string // any RSS 2.0, RSS 1.0 or Atom feed URL
      mode: 'list' | 'rotate' // 'list': as many headlines as fit. 'rotate': one headline at a time, cycling every intervalSec.
      color: string
      maxItems: number
      intervalSec: number
    }
  | { type: 'nowplaying'; color: string; align: 'left' | 'center' | 'right' } // OS-level "now playing" (Windows System Media Transport Controls) — whatever's currently playing in any app, not tied to this app's own media zones
  | {
      type: 'text'
      content: string
      color: string
      align: 'left' | 'center' | 'right'
      scale: number // 0.5-2, multiplies the auto-fit font size
      bold: boolean
    }
  | { type: 'color'; mode: 'solid' | 'gradient'; colorA: string; colorB: string; angle: number } // angle in degrees, gradient only
  | { type: 'layers'; items: LayerItem[] }
  | { type: 'blank' }

/**
 * A layer's `source` reuses the exact same `ZoneSource` union a top-level
 * zone uses — a YouTube layer and a GIF layer are the same mechanism, just
 * a different `source.type`, rendered through the same `ZoneRenderer`
 * recursively instead of a separate implementation per layer type. `x/y/
 * width/height` are 0-1 fractions of the `layers` zone's own box, so a
 * layer's position/size scales correctly whether that zone is full-bleed
 * or one column of a split layout.
 */
export type LayerFilter = 'none' | 'grayscale' | 'sepia' | 'blur' | 'invert'

export interface LayerItem {
  id: string
  x: number
  y: number
  width: number
  height: number
  opacity: number // 0-1
  zIndex: number
  filter: LayerFilter
  source: ZoneSource
}

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

export interface ScheduleEntry {
  id: string
  name: string
  presetId: string
  time: string // "HH:MM", 24h, local time
  days: number[] // 0 (Sunday) - 6 (Saturday); empty = every day
  enabled: boolean
}

export interface Trigger {
  id: string
  name: string
  metric: 'cpuTemp' | 'gpuTemp' | 'cpuLoad' | 'gpuLoad' | 'vramUsedPct' | 'ramUsedPct'
  op: '>' | '<'
  value: number
  holdSec: number
  clearBelow: number
  effect:
    | { type: 'glow'; color: string }
    | { type: 'flash'; color: string }
    | { type: 'preset'; presetId: string }
}

export interface MediaItem {
  path: string
  name: string
  kind: 'video' | 'image'
  mtimeMs: number
}

export interface NowPlayingInfo {
  active: boolean
  title: string | null
  artist: string | null
  appId: string | null // the source app's AppUserModelId, e.g. "Chrome" or "Spotify.exe" — shown as a fallback label when the app doesn't report a title
  status: 'playing' | 'paused' | 'stopped' | 'unknown'
}

export interface CalendarEvent {
  id: string
  title: string
  start: number // epoch ms
  end: number
  allDay: boolean
}

export interface WeatherReport {
  location: string // resolved display name, e.g. "Berlin, Land Berlin"
  units: 'metric' | 'imperial'
  current: {
    temperature: number
    weatherCode: number // WMO code, see shared/weather.ts
    windSpeed: number | null // km/h (metric) or mph (imperial)
    isDay: boolean
  }
  daily: Array<{ date: string; weatherCode: number; max: number | null; min: number | null }> // date is "YYYY-MM-DD" in the location's timezone
}

export interface FeedItem {
  id: string
  title: string
  link: string | null
  published: number | null // epoch ms
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
    transitionMs: number // crossfade duration when switching presets; 0 = instant cut (default)
  }
  controlWindow: {
    bounds: { x?: number; y?: number; width: number; height: number } | null
  }
  presets: Preset[]
  activePresetId: string
  layouts: Layout[]
  colorProfiles: ColorProfile[]
  triggers: Trigger[]
  schedule: ScheduleEntry[]
  recentMedia: string[] // MRU list of picked file paths, most recent first — for the "Recent" quick-pick instead of the OS file dialog every time
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
    accentColor: string // hex; recolors the control app's own UI (Settings), independent of any preset's color profile
    hotkeysEnabled: boolean // global Ctrl/Cmd+Alt+1-9 (presets) and +L/B/D (live/black/desktop mode)
    theme: 'dark' | 'light' // controls only the control app's own chrome, not the display output
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

export interface RemoteStatus {
  running: boolean
  url: string
  token: string
  qrDataUrl: string
}
