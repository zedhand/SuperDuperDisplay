import { describe, expect, it } from 'vitest'
import { buildSceneBundle, planSceneImport } from '../src/shared/sceneBundle'
import { defaultConfig } from '../src/shared/schema'

describe('scene bundles', () => {
  it('round-trips a scene into a config with fresh ids', () => {
    const preset = defaultConfig.presets[0]
    const bundle = buildSceneBundle(defaultConfig, preset.id)
    expect(bundle).not.toBeNull()
    const plan = planSceneImport(defaultConfig, JSON.parse(JSON.stringify(bundle)))
    if ('error' in plan) throw new Error(plan.error)
    const next = plan.patch
    expect(next.presets).toHaveLength(defaultConfig.presets.length + 1)
    const added = next.presets![next.presets!.length - 1]
    expect(added.id).not.toBe(preset.id)
    expect(added.name).toBe(`${preset.name} (imported)`)
    expect(next.layouts!.some((l) => l.id === added.layoutId)).toBe(true)
    expect(next.activePresetId).toBe(added.id)
  })

  it('adds the color profile when the target config lacks it', () => {
    const preset = defaultConfig.presets[0]
    const bundle = buildSceneBundle(defaultConfig, preset.id)!
    const custom = { ...bundle.colorProfile!, id: 'custom-x', name: 'Custom' }
    const raw = {
      ...bundle,
      preset: { ...bundle.preset, colorProfileId: 'custom-x' },
      colorProfile: custom
    }
    const plan = planSceneImport(defaultConfig, raw)
    if ('error' in plan) throw new Error(plan.error)
    expect(plan.patch.colorProfiles).toHaveLength(defaultConfig.colorProfiles.length + 1)
    const added = plan.patch.presets![plan.patch.presets!.length - 1]
    expect(added.colorProfileId).not.toBe('custom-x')
  })

  it('rejects other JSON', () => {
    expect('error' in planSceneImport(defaultConfig, { hello: 1 })).toBe(true)
  })

  it('returns null for an unknown scene', () => {
    expect(buildSceneBundle(defaultConfig, 'nope')).toBeNull()
  })
})
