import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ screen: {} }))

import { findCaseScreenCandidates, matchDisplay } from '../src/main/displays'
import type { DisplayInfo } from '../src/shared/types'

function d(id: number, x: number, w: number, h: number): DisplayInfo {
  return {
    id,
    label: `D${id}`,
    bounds: { x, y: 0, width: w, height: h },
    scaleFactor: 1,
    internal: false
  }
}

const main = d(1, 0, 2560, 1440)
const panel = d(2, 2560, 1920, 480)

describe('matchDisplay', () => {
  it('matches exact position + size', () => {
    const m = { label: 'p', width: 1920, height: 480, x: 2560, y: 0 }
    expect(matchDisplay([main, panel], m)?.id).toBe(2)
  })
  it('falls back to size when the panel moved ports', () => {
    const moved = d(3, 4000, 1920, 480)
    const m = { label: 'p', width: 1920, height: 480, x: 2560, y: 0 }
    expect(matchDisplay([main, moved], m)?.id).toBe(3)
  })
  it('auto-detects a known case-screen size with no saved match', () => {
    expect(matchDisplay([main, panel], null)?.id).toBe(2)
  })
  it('returns null when nothing fits', () => {
    expect(matchDisplay([main], null)).toBeNull()
  })
  it('recognises rotated case screens', () => {
    expect(findCaseScreenCandidates([main, d(4, 0, 480, 1920)])).toHaveLength(1)
  })
})
