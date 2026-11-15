import { describe, expect, it } from 'vitest'
import { pushSample, sparklinePath } from '../src/shared/sparkline'

describe('pushSample', () => {
  it('appends and trims to the limit', () => {
    expect(pushSample([1, 2, 3], 4, 3)).toEqual([2, 3, 4])
  })
  it('does not mutate the input', () => {
    const h = [1]
    pushSample(h, 2)
    expect(h).toEqual([1])
  })
  it('keeps nulls as gaps', () => {
    expect(pushSample([1], null, 5)).toEqual([1, null])
  })
})

describe('sparklinePath', () => {
  it('is empty with no history', () => {
    expect(sparklinePath([], 100, 100, 50)).toEqual({ line: '', area: '' })
  })
  it('right-aligns a short history and puts max at the top', () => {
    const { line } = sparklinePath([100], 100, 100, 50, 5)
    expect(line).toBe('M100.0,0.0')
  })
  it('puts zero at the bottom and clamps above max', () => {
    expect(sparklinePath([0], 100, 100, 50, 2).line).toBe('M100.0,50.0')
    expect(sparklinePath([500], 100, 100, 50, 2).line).toBe('M100.0,0.0')
  })
  it('breaks the line at gaps', () => {
    const { line } = sparklinePath([10, null, 20], 100, 100, 50, 3)
    expect(line.match(/M/g)).toHaveLength(2)
  })
  it('closes the filled area back to the baseline', () => {
    const { area } = sparklinePath([10, 20], 100, 100, 50, 2)
    expect(area.endsWith('Z')).toBe(true)
  })
})
