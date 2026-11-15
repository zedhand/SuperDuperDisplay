import { describe, expect, it } from 'vitest'
import { levelToRaw, rawToPercent } from '../src/shared/brightnessMath'

describe('brightness mapping', () => {
  it('maps percent onto a monitor range', () => {
    expect(levelToRaw(0, 0, 100)).toBe(0)
    expect(levelToRaw(50, 10, 90)).toBe(50)
    expect(levelToRaw(100, 10, 90)).toBe(90)
  })
  it('clamps out-of-range input', () => {
    expect(levelToRaw(-5, 0, 100)).toBe(0)
    expect(levelToRaw(500, 0, 100)).toBe(100)
  })
  it('round-trips', () => {
    for (const p of [0, 25, 60, 100])
      expect(Math.abs(rawToPercent(levelToRaw(p, 16, 80), 16, 80) - p)).toBeLessThanOrEqual(1)
  })
  it('handles a degenerate range', () => {
    expect(rawToPercent(5, 5, 5)).toBe(100)
  })
})
