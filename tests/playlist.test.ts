import { describe, expect, it } from 'vitest'
import { advancePlaylist, currentPlaylistIndex, initPlaylist } from '../src/shared/playlist'

describe('initPlaylist', () => {
  it('produces sequential order when not shuffled', () => {
    const state = initPlaylist(4, false)
    expect(state).toEqual({ order: [0, 1, 2, 3], pos: 0 })
  })

  it('produces a permutation of all indices when shuffled', () => {
    const state = initPlaylist(5, true)
    expect([...state.order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
    expect(state.pos).toBe(0)
  })
})

describe('advancePlaylist', () => {
  it('steps forward through the order without shuffling', () => {
    let state = initPlaylist(3, false)
    state = advancePlaylist(state, 3, false)
    expect(currentPlaylistIndex(state)).toBe(1)
    state = advancePlaylist(state, 3, false)
    expect(currentPlaylistIndex(state)).toBe(2)
  })

  it('wraps around to a fresh pass after the last item', () => {
    let state = initPlaylist(2, false)
    state = advancePlaylist(state, 2, false) // -> index 1
    state = advancePlaylist(state, 2, false) // wraps
    expect(state.pos).toBe(0)
    expect(state.order).toHaveLength(2)
  })

  it('rebuilds the order when item count changes (folder contents changed)', () => {
    let state = initPlaylist(2, false)
    state = advancePlaylist(state, 2, false)
    state = advancePlaylist(state, 5, false)
    expect(state.order).toEqual([0, 1, 2, 3, 4])
    expect(state.pos).toBe(0)
  })

  it('returns an empty playlist when there are no items', () => {
    const state = advancePlaylist(initPlaylist(3, false), 0, false)
    expect(state).toEqual({ order: [], pos: 0 })
    expect(currentPlaylistIndex(state)).toBe(0)
  })

  it('never repeats the same index twice in a row across a shuffled wrap, when more than one item exists', () => {
    let state = initPlaylist(3, true)
    for (let i = 0; i < 50; i++) {
      const before = currentPlaylistIndex(state)
      state = advancePlaylist(state, 3, true)
      const after = currentPlaylistIndex(state)
      expect(after).not.toBe(before)
    }
  })
})
