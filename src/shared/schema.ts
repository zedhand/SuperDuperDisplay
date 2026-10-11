import { z } from 'zod'
import type { AppConfig, LayerItem, ZoneSource } from './types'

const rotationSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
const fitModeSchema = z.enum(['cover', 'contain', 'stretch'])
const displayModeSchema = z.enum(['live', 'black', 'hidden'])

const displayMatchSchema = z.object({
  label: z.string().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  x: z.number().optional(),
  y: z.number().optional()
})

const colorProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  brightness: z.number().min(0).max(2),
  contrast: z.number().min(0).max(2),
  saturation: z.number().min(0).max(2),
  hue: z.number().min(-180).max(180),
  gamma: z.number().min(0.1).max(3)
})

// Mutually recursive: a `layers` zone's items each carry a full
// `ZoneSource` (so a layer can itself be `layers`, or media, YouTube,
// stats, ...), so both schemas are wrapped in `z.lazy()` and typed
// explicitly — the standard zod pattern for a recursive schema. Neither
// lazy callback actually runs until something is parsed, by which point
// both consts below are already assigned, so the forward reference from
// `zoneSourceSchema` to `layerItemSchema` (defined after it) is safe.
const zoneSourceSchema: z.ZodType<ZoneSource> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('media'),
      path: z.string().optional(),
      folder: z.string().optional(),
      shuffle: z.boolean(),
      intervalSec: z.number().nonnegative(),
      fit: fitModeSchema,
      bg: z.enum(['solid', 'blur']),
      bgColor: z.string(),
      volume: z.number().min(0).max(1).default(0),
      loop: z.boolean().default(true),
      trimStart: z.number().nonnegative().optional(),
      trimEnd: z.number().nonnegative().optional()
    }),
    z.object({
      type: z.literal('youtube'),
      url: z.string(),
      volume: z.number().min(0).max(1).default(0)
    }),
    z.object({
      type: z.literal('web'),
      url: z.string(),
      css: z.string().optional(),
      volume: z.number().min(0).max(1).default(0)
    }),
    z.object({
      type: z.literal('stats'),
      widgets: z.array(z.string()),
      style: z.enum(['bars', 'gauges', 'compact'])
    }),
    z.object({
      type: z.literal('camera'),
      deviceId: z.string().optional(),
      rtspUrl: z.string().optional()
    }),
    z.object({
      type: z.literal('clock'),
      format: z.enum(['12h', '24h']),
      showDate: z.boolean(),
      color: z.string(),
      align: z.enum(['left', 'center', 'right'])
    }),
    z.object({
      type: z.literal('calendar'),
      accentColor: z.string(),
      mode: z.enum(['grid', 'agenda']).default('grid'),
      icsUrl: z.string().optional()
    }),
    z.object({
      type: z.literal('nowplaying'),
      color: z.string(),
      align: z.enum(['left', 'center', 'right'])
    }),
    z.object({
      type: z.literal('text'),
      content: z.string(),
      color: z.string(),
      align: z.enum(['left', 'center', 'right']),
      scale: z.number().min(0.5).max(2),
      bold: z.boolean()
    }),
    z.object({
      type: z.literal('color'),
      mode: z.enum(['solid', 'gradient']),
      colorA: z.string(),
      colorB: z.string(),
      angle: z.number()
    }),
    z.object({
      type: z.literal('layers'),
      items: z.array(layerItemSchema)
    }),
    z.object({ type: z.literal('blank') })
  ])
)

const layerItemSchema: z.ZodType<LayerItem> = z.lazy(() =>
  z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    opacity: z.number().min(0).max(1),
    zIndex: z.number(),
    filter: z.enum(['none', 'grayscale', 'sepia', 'blur', 'invert']).default('none'),
    source: zoneSourceSchema
  })
)

const layoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  split: z.enum(['single', 'h', 'v', 'grid']),
  sizes: z.array(z.number().positive())
})

const presetSchema = z.object({
  id: z.string(),
  name: z.string(),
  layoutId: z.string(),
  zones: z.record(z.string(), zoneSourceSchema),
  colorProfileId: z.string(),
  fit: fitModeSchema
})

const triggerSchema = z.object({
  id: z.string(),
  name: z.string(),
  metric: z.enum(['cpuTemp', 'gpuTemp', 'cpuLoad', 'gpuLoad', 'vramUsedPct', 'ramUsedPct']),
  op: z.enum(['>', '<']),
  value: z.number(),
  holdSec: z.number().nonnegative(),
  clearBelow: z.number(),
  effect: z.discriminatedUnion('type', [
    z.object({ type: z.literal('glow'), color: z.string() }),
    z.object({ type: z.literal('flash'), color: z.string() }),
    z.object({ type: z.literal('preset'), presetId: z.string() })
  ])
})

const scheduleEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  presetId: z.string(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM (24h)'),
  days: z.array(z.number().int().min(0).max(6)),
  enabled: z.boolean()
})

export const appConfigSchema: z.ZodType<AppConfig> = z.object({
  version: z.number(),
  display: z.object({
    match: displayMatchSchema.nullable(),
    rotation: rotationSchema,
    simulate: z.boolean(),
    mode: displayModeSchema,
    transitionMs: z.number().nonnegative().default(0)
  }),
  controlWindow: z.object({
    bounds: z
      .object({
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number(),
        height: z.number()
      })
      .nullable()
  }),
  presets: z.array(presetSchema),
  activePresetId: z.string(),
  layouts: z.array(layoutSchema),
  colorProfiles: z.array(colorProfileSchema),
  triggers: z.array(triggerSchema),
  schedule: z.array(scheduleEntrySchema).default([]),
  recentMedia: z.array(z.string()).default([]),
  telemetry: z.object({
    source: z.enum(['auto', 'lhm', 'si']),
    lhmUrl: z.string(),
    intervalMs: z.number().positive()
  }),
  power: z.object({
    blankOnLock: z.boolean(),
    blankOnSuspend: z.boolean(),
    idleBlankMin: z.number().nonnegative()
  }),
  remote: z.object({
    enabled: z.boolean(),
    port: z.number().int().positive(),
    token: z.string()
  }),
  app: z.object({
    launchAtLogin: z.boolean(),
    startMinimized: z.boolean(),
    accentColor: z.string().default('#d946ef'),
    hotkeysEnabled: z.boolean().default(false),
    theme: z.enum(['dark', 'light']).default('dark')
  })
})

export const CONFIG_VERSION = 1

const NEUTRAL_COLOR_PROFILE_ID = 'neutral'
const LAYOUT_SINGLE_ID = 'single'
const LAYOUT_SPLIT_70_30_ID = 'split-70-30'
const LAYOUT_STATS_ONLY_ID = 'stats-only'

export const defaultConfig: AppConfig = {
  version: CONFIG_VERSION,
  display: {
    match: null,
    rotation: 0,
    simulate: true,
    mode: 'live',
    transitionMs: 0
  },
  controlWindow: {
    bounds: null
  },
  colorProfiles: [
    {
      id: NEUTRAL_COLOR_PROFILE_ID,
      name: 'Neutral',
      brightness: 1,
      contrast: 1,
      saturation: 1,
      hue: 0,
      gamma: 1
    }
  ],
  layouts: [
    { id: LAYOUT_SINGLE_ID, name: 'Full bleed', split: 'single', sizes: [1] },
    { id: LAYOUT_SPLIT_70_30_ID, name: '70 / 30 split', split: 'h', sizes: [0.7, 0.3] },
    { id: LAYOUT_STATS_ONLY_ID, name: 'Stats only', split: 'single', sizes: [1] }
  ],
  presets: [
    {
      id: 'full-bleed-loop',
      name: 'Full-bleed loop',
      layoutId: LAYOUT_SINGLE_ID,
      colorProfileId: NEUTRAL_COLOR_PROFILE_ID,
      fit: 'cover',
      zones: {
        zone0: {
          type: 'blank'
        }
      }
    },
    {
      id: 'media-plus-stats',
      name: 'Split Zones',
      layoutId: LAYOUT_SPLIT_70_30_ID,
      colorProfileId: NEUTRAL_COLOR_PROFILE_ID,
      fit: 'cover',
      zones: {
        zone0: { type: 'blank' },
        zone1: {
          type: 'stats',
          widgets: ['cpuTemp', 'cpuLoad', 'gpuTemp', 'gpuLoad'],
          style: 'bars'
        }
      }
    },
    {
      id: 'stats-only',
      name: 'Stats only',
      layoutId: LAYOUT_STATS_ONLY_ID,
      colorProfileId: NEUTRAL_COLOR_PROFILE_ID,
      fit: 'cover',
      zones: {
        zone0: {
          type: 'stats',
          widgets: [
            'cpuTemp',
            'cpuLoad',
            'cpuClockMHz',
            'gpuTemp',
            'gpuLoad',
            'gpuClockMHz',
            'vramUsedPct',
            'ramUsedPct'
          ],
          style: 'gauges'
        }
      }
    },
    {
      id: 'black',
      name: 'Black',
      layoutId: LAYOUT_SINGLE_ID,
      colorProfileId: NEUTRAL_COLOR_PROFILE_ID,
      fit: 'cover',
      zones: { zone0: { type: 'blank' } }
    }
  ],
  activePresetId: 'full-bleed-loop',
  triggers: [],
  schedule: [],
  recentMedia: [],
  telemetry: {
    source: 'auto',
    lhmUrl: 'http://localhost:8085/data.json',
    intervalMs: 1000
  },
  power: {
    blankOnLock: true,
    blankOnSuspend: true,
    idleBlankMin: 0
  },
  remote: {
    enabled: false,
    port: 8787,
    token: ''
  },
  app: {
    launchAtLogin: false,
    startMinimized: false,
    accentColor: '#d946ef',
    hotkeysEnabled: false,
    theme: 'dark'
  }
}
