import { describe, expect, it } from 'vitest'
import { dimOpacity, inTimeWindow, pixelShiftOffset } from '../src/shared/displayFx'

const at = (h: number, m = 0): Date => new Date(2026, 0, 1, h, m)

describe('inTimeWindow', () => {
  it('handles a same-day window', () => {
    expect(inTimeWindow('09:00', '17:00', at(12))).toBe(true)
    expect(inTimeWindow('09:00', '17:00', at(17))).toBe(false)
  })
  it('handles a window wrapping midnight', () => {
    expect(inTimeWindow('22:00', '07:00', at(23))).toBe(true)
    expect(inTimeWindow('22:00', '07:00', at(3))).toBe(true)
    expect(inTimeWindow('22:00', '07:00', at(12))).toBe(false)
  })
  it('rejects bad input', () => {
    expect(inTimeWindow('xx', '07:00', at(3))).toBe(false)
    expect(inTimeWindow('08:00', '08:00', at(8))).toBe(false)
  })
})

describe('dimOpacity', () => {
  const dim = { level: 60, scheduled: false, from: '22:00', to: '07:00' }
  it('is constant when not scheduled', () => {
    expect(dimOpacity(dim, at(12))).toBeCloseTo(0.6)
  })
  it('only applies inside the window when scheduled', () => {
    expect(dimOpacity({ ...dim, scheduled: true }, at(12))).toBe(0)
    expect(dimOpacity({ ...dim, scheduled: true }, at(23))).toBeCloseTo(0.6)
  })
  it('never fully blacks out', () => {
    expect(dimOpacity({ ...dim, level: 100 }, at(12))).toBeLessThan(1)
  })
  it('is zero at level 0', () => {
    expect(dimOpacity({ ...dim, level: 0 }, at(12))).toBe(0)
  })
})

describe('pixelShiftOffset', () => {
  it('stays within 2px', () => {
    for (let m = 0; m < 20; m++) {
      const o = pixelShiftOffset(new Date(m * 60_000))
      expect(Math.abs(o.x)).toBeLessThanOrEqual(2)
      expect(Math.abs(o.y)).toBeLessThanOrEqual(2)
    }
  })
})
