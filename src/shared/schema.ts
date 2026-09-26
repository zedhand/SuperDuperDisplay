import { z } from 'zod'
import type { AppConfig } from './types'

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

const zoneSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('media'),
    path: z.string().optional(),
    folder: z.string().optional(),
    shuffle: z.boolean(),
    intervalSec: z.number().nonnegative(),
    fit: fitModeSchema,
    bg: z.enum(['solid', 'blur']),
    bgColor: z.string()
  }),
  z.object({ type: z.literal('youtube'), url: z.string() }),
  z.object({ type: z.literal('web'), url: z.string(), css: z.string().optional() }),
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
  z.object({ type: z.literal('blank') })
])

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
    z.object({ type: z.literal('preset'), presetId: z.string() })
  ])
})

export const appConfigSchema: z.ZodType<AppConfig> = z.object({
  version: z.number(),
  display: z.object({
    match: displayMatchSchema.nullable(),
    rotation: rotationSchema,
    simulate: z.boolean(),
    mode: displayModeSchema
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
    startMinimized: z.boolean()
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
    mode: 'live'
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
      name: '70/30 media + stats',
      layoutId: LAYOUT_SPLIT_70_30_ID,
      colorProfileId: NEUTRAL_COLOR_PROFILE_ID,
      fit: 'cover',
      zones: {
        zone0: { type: 'blank' },
        zone1: {
          type: 'stats',
          widgets: ['cpuTemp', 'gpuTemp', 'cpuLoad', 'gpuLoad'],
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
          widgets: ['cpuTemp', 'gpuTemp', 'cpuLoad', 'gpuLoad', 'vramUsedPct', 'ramUsedPct'],
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
    startMinimized: false
  }
}
