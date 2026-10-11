import { useEffect, useState, type ReactElement } from 'react'
import type { ContainBackground, FitMode } from '@shared/types'
import { toMediaUrl } from '@shared/media'
import {
  advancePlaylist,
  currentPlaylistIndex,
  initPlaylist,
  type PlaylistState
} from '@shared/playlist'
import { MediaZone } from './MediaZone'
import { ZonePlaceholder } from './ZonePlaceholder'

interface MediaFile {
  path: string
  kind: 'video' | 'image'
}

/**
 * Drives a media zone whose source is a watched folder rather than one
 * fixed file: rotates through the folder's contents on a timer (optionally
 * shuffled), handing the current item to MediaZone so its existing
 * cross-fade logic animates every transition, both between files and at a
 * single video's own loop point.
 */
export function FolderMediaZone({
  folder,
  shuffle,
  intervalSec,
  fit,
  bg,
  bgColor,
  volume
}: {
  folder: string
  shuffle: boolean
  intervalSec: number
  fit: FitMode
  bg: ContainBackground
  bgColor: string
  volume: number
}): ReactElement {
  const [items, setItems] = useState<MediaFile[]>([])
  const [playlist, setPlaylist] = useState<PlaylistState>(() => initPlaylist(0, shuffle))

  useEffect(
    () =>
      window.display.onMediaFolderChanged((changedFolder, newItems) => {
        if (changedFolder !== folder) return
        setItems(newItems.map((i) => ({ path: i.path, kind: i.kind })))
      }),
    [folder]
  )

  // Adjusting state during render (React's documented pattern for "reset
  // state when a prop/derived value changes") rather than in an effect:
  // this rebuilds the playlist in the same render the item count changes
  // in, instead of committing a stale render first and fixing it up a tick
  // later via an effect-triggered re-render.
  if (playlist.order.length !== items.length) {
    setPlaylist(initPlaylist(items.length, shuffle))
  }

  useEffect(() => {
    if (intervalSec <= 0 || items.length <= 1) return
    const id = setInterval(() => {
      setPlaylist((prev) => advancePlaylist(prev, items.length, shuffle))
    }, intervalSec * 1000)
    return () => clearInterval(id)
  }, [items.length, intervalSec, shuffle])

  const current = items[currentPlaylistIndex(playlist)]
  if (!current) return <ZonePlaceholder label="Folder is empty" />

  return (
    <MediaZone
      item={{ src: toMediaUrl(current.path), kind: current.kind }}
      fit={fit}
      bg={bg}
      bgColor={bgColor}
      volume={volume}
    />
  )
}
