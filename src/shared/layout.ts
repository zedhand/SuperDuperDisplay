import type { AppConfig, Layout, ResolvedZone, Rotation, ZoneSource } from './types'

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
