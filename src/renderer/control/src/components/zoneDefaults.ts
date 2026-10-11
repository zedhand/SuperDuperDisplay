import type { ZoneSource } from '@shared/types'

export const FIT_MODES: Array<'cover' | 'contain' | 'stretch'> = ['cover', 'contain', 'stretch']
export const STATS_STYLES: Array<'bars' | 'gauges' | 'compact'> = ['bars', 'gauges', 'compact']

export function defaultMediaSource(source: { path?: string; folder?: string }): ZoneSource {
  return {
    type: 'media',
    ...source,
    shuffle: false,
    intervalSec: 8,
    fit: 'cover',
    bg: 'blur',
    bgColor: '#000000',
    volume: 0,
    loop: true
  }
}

const MAX_RECENT_MEDIA = 15

/** Moves `path` to the front of the MRU list (de-duplicating), capped at `MAX_RECENT_MEDIA` — the "Recent" quick-pick instead of the OS file dialog every time. */
export function pushRecentMedia(recent: string[], path: string): string[] {
  return [path, ...recent.filter((p) => p !== path)].slice(0, MAX_RECENT_MEDIA)
}

/**
 * Every zone-source type a "new item" button can create, shared by the
 * top-level zone editor (Scenes) and the layers-canvas "+ Add" menu — a
 * layer is just a `ZoneSource` in a free-form box, so the same list of
 * creatable types applies in both places. `layers` is deliberately left
 * out here: nesting a `layers` zone inside another is a harmless
 * consequence of the data model reusing the same union, not a feature
 * exposed in the UI for v1.
 */
export const TYPE_SWITCH_OPTIONS: Array<{ label: string; make: () => ZoneSource }> = [
  { label: 'YouTube', make: () => ({ type: 'youtube', url: '', volume: 0 }) },
  { label: 'Web', make: () => ({ type: 'web', url: '', volume: 0 }) },
  {
    label: 'Stats',
    make: () => ({ type: 'stats', widgets: ['cpuTemp', 'gpuTemp'], style: 'bars' })
  },
  { label: 'Camera', make: () => ({ type: 'camera' }) },
  {
    label: 'Clock',
    make: () => ({
      type: 'clock',
      format: '12h',
      showDate: true,
      color: '#ffffff',
      align: 'center'
    })
  },
  {
    label: 'Calendar',
    make: () => ({ type: 'calendar', accentColor: '#e879f9', mode: 'grid' })
  },
  {
    label: 'Weather',
    make: () => ({
      type: 'weather',
      location: '',
      units: 'metric',
      color: '#ffffff',
      showForecast: true
    })
  },
  {
    label: 'RSS',
    make: () => ({
      type: 'rss',
      feedUrl: '',
      mode: 'list',
      color: '#ffffff',
      maxItems: 8,
      intervalSec: 8
    })
  },
  {
    label: 'Now Playing',
    make: () => ({ type: 'nowplaying', color: '#ffffff', align: 'left' })
  },
  {
    label: 'Text',
    make: () => ({
      type: 'text',
      content: 'Text',
      color: '#ffffff',
      align: 'center',
      scale: 1,
      bold: false
    })
  },
  {
    label: 'Color',
    make: () => ({ type: 'color', mode: 'solid', colorA: '#e879f9', colorB: '#22d3ee', angle: 90 })
  },
  { label: 'Blank', make: () => ({ type: 'blank' }) }
]
