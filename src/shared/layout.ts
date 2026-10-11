import type { AppConfig, Layout, Preset, ResolvedZone, Rotation, ZoneSource } from './types'

/**
 * Splits a layout into percentage rects, in reading order (left-to-right for
 * 'h', top-to-bottom for 'v'). 'single' and 'grid' both currently resolve
 * to a single full-bleed zone list sized by `sizes.length`.
 */
export function resolveZoneRects(
  layout: Layout
): Array<{ xPct: number; yPct: number; wPct: number; hPct: number }> {
  const total = layout.sizes.reduce((sum, s) => sum + s, 0)
  if (total <= 0) {
    throw new Error(`Layout "${layout.id}" has zero or negative total size`)
  }
  const fractions = layout.sizes.map((s) => s / total)

  if (layout.split === 'h') {
    let x = 0
    return fractions.map((w) => {
      const rect = { xPct: x, yPct: 0, wPct: w, hPct: 1 }
      x += w
      return rect
    })
  }

  if (layout.split === 'v') {
    let y = 0
    return fractions.map((h) => {
      const rect = { xPct: 0, yPct: y, wPct: 1, hPct: h }
      y += h
      return rect
    })
  }

  // 'single' and 'grid' (grid layout composition is deferred; treated as single for now)
  return fractions.map(() => ({ xPct: 0, yPct: 0, wPct: 1, hPct: 1 }))
}

export function resolveZones(
  layout: Layout,
  zoneSources: Record<string, ZoneSource>
): ResolvedZone[] {
  const rects = resolveZoneRects(layout)
  const zoneIds = Object.keys(zoneSources).sort()
  return rects.map((rect, i) => {
    const zoneId = zoneIds[i] ?? `zone${i}`
    return {
      zoneId,
      rect,
      source: zoneSources[zoneId] ?? { type: 'blank' }
    }
  })
}

/**
 * Layouts are shared by id across presets (e.g. the default "single" layout
 * backs both "Full-bleed loop" and "Black") — mutating one in place would
 * silently reshape every other preset that happens to reference the same
 * layout. Clones it for this preset the moment more than one preset relies
 * on it, so an edit only ever affects the preset being looked at. Shared by
 * both the Layout page's drag-to-resize editor and Scenes' per-zone
 * aspect-ratio auto-fit — getting this subtly wrong reintroduces the exact
 * cross-preset-mutation bug this was written to fix.
 */
export function updateLayoutForPreset(
  config: AppConfig,
  activePreset: Preset,
  layout: Layout,
  updater: (l: Layout) => Layout
): { layouts: Layout[]; presets: Preset[] } {
  const sharedWithOtherPresets = config.presets.some(
    (p) => p.id !== activePreset.id && p.layoutId === layout.id
  )
  if (sharedWithOtherPresets) {
    const cloned = updater({
      ...layout,
      id: crypto.randomUUID(),
      name: `${layout.name} (${activePreset.name})`
    })
    return {
      layouts: [...config.layouts, cloned],
      presets: config.presets.map((p) =>
        p.id === activePreset.id ? { ...p, layoutId: cloned.id } : p
      )
    }
  }
  return {
    layouts: config.layouts.map((l) => (l.id === layout.id ? updater(l) : l)),
    presets: config.presets
  }
}

/**
 * Computes new `sizes` for an `h`/`v` layout so the zone at `zoneIndex`
 * renders at exactly `targetAspect` (width/height) given the physical
 * content pixel size, redistributing the remaining space among the other
 * zones in their existing relative proportions. Returns `null` for
 * `single`/`grid` splits (every zone is already full-bleed — there's
 * nothing to resize) or an out-of-range index.
 */
export function computeAutoFitSizes(
  layout: Pick<Layout, 'split' | 'sizes'>,
  zoneIndex: number,
  targetAspect: number,
  contentSize: { width: number; height: number }
): number[] | null {
  if (layout.split !== 'h' && layout.split !== 'v') return null
  if (zoneIndex < 0 || zoneIndex >= layout.sizes.length) return null
  if (!Number.isFinite(targetAspect) || targetAspect <= 0) return null

  const MIN_FRAC = 0.05
  const MAX_FRAC = 0.95
  const rawFrac =
    layout.split === 'h'
      ? (targetAspect * contentSize.height) / contentSize.width
      : contentSize.width / (targetAspect * contentSize.height)
  const frac = Math.min(MAX_FRAC, Math.max(MIN_FRAC, rawFrac))

  const others = layout.sizes.filter((_, i) => i !== zoneIndex)
  const othersTotal = others.reduce((sum, s) => sum + s, 0) || 1
  const remaining = 1 - frac
  return layout.sizes.map((s, i) => (i === zoneIndex ? frac : (s / othersTotal) * remaining))
}

/** Swaps width/height for 90/270 rotations, since the content is drawn in "unrotated" logical space and then CSS-rotated onto the physical panel. */
export function rotatedContentSize(
  physical: { width: number; height: number },
  rotation: Rotation
): { width: number; height: number } {
  if (rotation === 90 || rotation === 270) {
    return { width: physical.height, height: physical.width }
  }
  return { width: physical.width, height: physical.height }
}

/** Folder paths referenced by media zones on the currently active preset — the set a folder watcher should keep live. */
export function getActiveMediaFolders(config: AppConfig): string[] {
  const preset = config.presets.find((p) => p.id === config.activePresetId)
  if (!preset) return []
  const folders = Object.values(preset.zones)
    .filter((zone): zone is Extract<ZoneSource, { type: 'media' }> => zone.type === 'media')
    .map((zone) => zone.folder)
    .filter((folder): folder is string => Boolean(folder))
  return [...new Set(folders)]
}

/**
 * Returns just the rotate() function (or '' for no rotation), never the
 * keyword 'none' — that keyword is only valid as the transform property's
 * sole value, and silently invalidates the whole declaration when combined
 * with another transform function like translate(), e.g. in a centering
 * transform such as `translate(-50%, -50%) ${rotationCssTransform(...)}`.
 */
export function rotationCssTransform(rotation: Rotation): string {
  if (rotation === 0) return ''
  return `rotate(${rotation}deg)`
}
