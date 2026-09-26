import { describe, expect, it } from 'vitest'
import {
  resolveZoneRects,
  resolveZones,
  rotatedContentSize,
  rotationCssTransform
} from '../src/shared/layout'
import type { Layout, ZoneSource } from '../src/shared/types'

describe('resolveZoneRects', () => {
  it('returns a single full-bleed rect for a single-split layout', () => {
    const layout: Layout = { id: 'l', name: 'L', split: 'single', sizes: [1] }
    expect(resolveZoneRects(layout)).toEqual([{ xPct: 0, yPct: 0, wPct: 1, hPct: 1 }])
  })

  it('splits horizontally left-to-right in proportion to sizes', () => {
    const layout: Layout = { id: 'l', name: 'L', split: 'h', sizes: [0.7, 0.3] }
    const rects = resolveZoneRects(layout)
    expect(rects).toHaveLength(2)
    expect(rects[0]).toEqual({ xPct: 0, yPct: 0, wPct: 0.7, hPct: 1 })
    expect(rects[1].xPct).toBeCloseTo(0.7)
    expect(rects[1].wPct).toBeCloseTo(0.3)
  })

  it('splits vertically top-to-bottom in proportion to sizes', () => {
    const layout: Layout = { id: 'l', name: 'L', split: 'v', sizes: [1, 1, 2] }
    const rects = resolveZoneRects(layout)
    expect(rects[0]).toEqual({ xPct: 0, yPct: 0, wPct: 1, hPct: 0.25 })
    expect(rects[1].yPct).toBeCloseTo(0.25)
    expect(rects[2].hPct).toBeCloseTo(0.5)
  })

  it('normalizes sizes that do not sum to 1', () => {
    const layout: Layout = { id: 'l', name: 'L', split: 'h', sizes: [2, 2] }
    const rects = resolveZoneRects(layout)
    expect(rects[0].wPct).toBeCloseTo(0.5)
    expect(rects[1].wPct).toBeCloseTo(0.5)
  })

  it('throws on a layout with zero total size', () => {
    const layout: Layout = { id: 'l', name: 'L', split: 'h', sizes: [0, 0] }
    expect(() => resolveZoneRects(layout)).toThrow()
  })
})

describe('resolveZones', () => {
  it('pairs sorted zone ids with rects in order', () => {
    const layout: Layout = { id: 'l', name: 'L', split: 'h', sizes: [0.5, 0.5] }
    const zones: Record<string, ZoneSource> = {
      zone1: { type: 'blank' },
      zone0: { type: 'youtube', url: 'https://youtu.be/x' }
    }
    const resolved = resolveZones(layout, zones)
    expect(resolved.map((z) => z.zoneId)).toEqual(['zone0', 'zone1'])
    expect(resolved[0].source).toEqual({ type: 'youtube', url: 'https://youtu.be/x' })
  })

  it('falls back to a blank zone when there are fewer sources than rects', () => {
    const layout: Layout = { id: 'l', name: 'L', split: 'h', sizes: [0.5, 0.5] }
    const zones: Record<string, ZoneSource> = { zone0: { type: 'blank' } }
    const resolved = resolveZones(layout, zones)
    expect(resolved[1].source).toEqual({ type: 'blank' })
  })
})

describe('rotatedContentSize', () => {
  it('keeps dimensions unchanged at 0 and 180 degrees', () => {
    const physical = { width: 1920, height: 480 }
    expect(rotatedContentSize(physical, 0)).toEqual({ width: 1920, height: 480 })
    expect(rotatedContentSize(physical, 180)).toEqual({ width: 1920, height: 480 })
  })

  it('swaps dimensions at 90 and 270 degrees', () => {
    const physical = { width: 1920, height: 480 }
    expect(rotatedContentSize(physical, 90)).toEqual({ width: 480, height: 1920 })
    expect(rotatedContentSize(physical, 270)).toEqual({ width: 480, height: 1920 })
  })
})

describe('rotationCssTransform', () => {
  it('returns an empty string for 0 degrees, never the keyword "none"', () => {
    expect(rotationCssTransform(0)).toBe('')
  })

  it('returns a rotate() transform for non-zero rotations', () => {
    expect(rotationCssTransform(90)).toBe('rotate(90deg)')
    expect(rotationCssTransform(270)).toBe('rotate(270deg)')
  })

  it('composes cleanly with a preceding translate() in a transform list', () => {
    expect(`translate(-50%, -50%) ${rotationCssTransform(0)}`.trim()).toBe('translate(-50%, -50%)')
  })
})
