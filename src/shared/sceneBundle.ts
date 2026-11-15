import { z } from 'zod'
import { colorProfileSchema, layoutSchema, presetSchema } from './schema'
import type { AppConfig, ColorProfile, Layout, Preset } from './types'

const FORMAT = 'superduperdisplay-scene'

const bundleSchema = z.object({
  format: z.literal(FORMAT),
  version: z.literal(1),
  preset: presetSchema,
  layout: layoutSchema,
  colorProfile: colorProfileSchema.optional()
})

export type SceneBundle = z.infer<typeof bundleSchema>

/** Packages one scene with the layout and color profile it depends on. Local file paths inside it are included as-is. */
export function buildSceneBundle(config: AppConfig, presetId: string): SceneBundle | null {
  const preset = config.presets.find((p) => p.id === presetId)
  const layout = preset && config.layouts.find((l) => l.id === preset.layoutId)
  if (!preset || !layout) return null
  const colorProfile = config.colorProfiles.find((c) => c.id === preset.colorProfileId)
  return {
    format: FORMAT,
    version: 1,
    preset,
    layout,
    ...(colorProfile ? { colorProfile } : {})
  }
}

/** Validates raw JSON and returns the config patch that adds the scene with fresh ids (never overwrites anything), or an error message. */
export function planSceneImport(
  config: AppConfig,
  raw: unknown
): { patch: Partial<AppConfig> } | { error: string } {
  const parsed = bundleSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Not a SuperDuperDisplay scene file.' }
  const { preset, layout, colorProfile } = parsed.data

  const newLayout: Layout = { ...layout, id: crypto.randomUUID() }
  let colorProfiles = config.colorProfiles
  let colorProfileId = preset.colorProfileId
  if (!colorProfiles.some((c) => c.id === colorProfileId)) {
    if (colorProfile) {
      const added: ColorProfile = { ...colorProfile, id: crypto.randomUUID() }
      colorProfiles = [...colorProfiles, added]
      colorProfileId = added.id
    } else {
      colorProfileId = colorProfiles[0]?.id ?? colorProfileId
    }
  }
  const newPreset: Preset = {
    ...preset,
    id: crypto.randomUUID(),
    name: config.presets.some((p) => p.name === preset.name)
      ? `${preset.name} (imported)`
      : preset.name,
    layoutId: newLayout.id,
    colorProfileId
  }
  return {
    patch: {
      layouts: [...config.layouts, newLayout],
      presets: [...config.presets, newPreset],
      colorProfiles,
      activePresetId: newPreset.id
    }
  }
}
