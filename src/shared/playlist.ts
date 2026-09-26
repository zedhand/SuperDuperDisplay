/** A playing-order over `order.length` items, with `pos` pointing at the currently shown one (an index into `order`, which itself holds item indices). */
export interface PlaylistState {
  order: number[]
  pos: number
}

function buildOrder(itemCount: number, shuffle: boolean): number[] {
  const indices = Array.from({ length: itemCount }, (_, i) => i)
  if (!shuffle) return indices
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices
}

export function initPlaylist(itemCount: number, shuffle: boolean): PlaylistState {
  return { order: buildOrder(itemCount, shuffle), pos: 0 }
}

/**
 * Moves to the next item. If `itemCount` no longer matches the current
 * order (the watched folder's contents changed), the order is rebuilt from
 * scratch. Otherwise, reaching the end of the order rebuilds it too (a
 * fresh shuffle for the next pass); when shuffled, the new order's first
 * item is swapped away from a same-item repeat at that seam.
 */
export function advancePlaylist(
  state: PlaylistState,
  itemCount: number,
  shuffle: boolean
): PlaylistState {
  if (itemCount === 0) return { order: [], pos: 0 }
  if (state.order.length !== itemCount) return initPlaylist(itemCount, shuffle)

  const nextPos = state.pos + 1
  if (nextPos < state.order.length) return { order: state.order, pos: nextPos }

  const order = buildOrder(itemCount, shuffle)
  const lastShownIndex = state.order[state.pos]
  if (shuffle && itemCount > 1 && order[0] === lastShownIndex) {
    ;[order[0], order[1]] = [order[1], order[0]]
  }
  return { order, pos: 0 }
}

export function currentPlaylistIndex(state: PlaylistState): number {
  return state.order[state.pos] ?? 0
}
