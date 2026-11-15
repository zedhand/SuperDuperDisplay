import { describe, expect, it } from 'vitest'
import { appConfigSchema, defaultConfig } from '../src/shared/schema'

describe('appConfigSchema', () => {
  it('accepts the shipped default config', () => {
    expect(() => appConfigSchema.parse(defaultConfig)).not.toThrow()
  })

  it('every preset references a layoutId and colorProfileId that exist', () => {
    const layoutIds = new Set(defaultConfig.layouts.map((l) => l.id))
    const colorProfileIds = new Set(defaultConfig.colorProfiles.map((c) => c.id))
    for (const preset of defaultConfig.presets) {
      expect(layoutIds.has(preset.layoutId)).toBe(true)
      expect(colorProfileIds.has(preset.colorProfileId)).toBe(true)
    }
  })

  it('activePresetId references an existing preset', () => {
    const presetIds = new Set(defaultConfig.presets.map((p) => p.id))
    expect(presetIds.has(defaultConfig.activePresetId)).toBe(true)
  })

  it('rejects an invalid rotation value', () => {
    const bad = { ...defaultConfig, display: { ...defaultConfig.display, rotation: 45 } }
    expect(() => appConfigSchema.parse(bad)).toThrow()
  })

  it('rejects a zone source with an unknown discriminant', () => {
    const bad = {
      ...defaultConfig,
      presets: [
        {
          ...defaultConfig.presets[0],
          zones: { zone0: { type: 'not-a-real-type' } }
        }
      ]
    }
    expect(() => appConfigSchema.parse(bad)).toThrow()
  })

  it('accepts weather and rss zones, filling defaults for older-style entries', () => {
    const config = {
      ...defaultConfig,
      presets: [
        {
          ...defaultConfig.presets[0],
          zones: {
            zone0: { type: 'weather', location: 'London', color: '#ffffff' },
            zone1: { type: 'rss', feedUrl: 'https://example.com/feed', color: '#ffffff' }
          }
        }
      ]
    }
    const parsed = appConfigSchema.parse(config)
    expect(parsed.presets[0].zones.zone0).toMatchObject({ units: 'metric', showForecast: true })
    expect(parsed.presets[0].zones.zone1).toMatchObject({
      mode: 'list',
      maxItems: 8,
      intervalSec: 8
    })
  })
})

describe('config migration defaults', () => {
  it('fills in newer display/appRules fields for configs saved before they existed', async () => {
    const { appConfigSchema, defaultConfig } = await import('../src/shared/schema')
    const old = JSON.parse(JSON.stringify(defaultConfig))
    delete old.display.lockMouse
    delete old.display.keepWindowsOff
    delete old.display.dim
    delete old.display.pixelShift
    delete old.appRules
    const parsed = appConfigSchema.parse(old)
    expect(parsed.display.lockMouse).toBe(false)
    expect(parsed.display.dim.level).toBe(0)
    expect(parsed.display.pixelShift).toBe(false)
    expect(parsed.appRules).toEqual([])
  })
})
