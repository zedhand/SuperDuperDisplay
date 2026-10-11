import chokidar, { type FSWatcher } from 'chokidar'
import { statSync } from 'fs'
import { basename, extname, join } from 'path'
import type { MediaItem } from '@shared/types'
import { mediaKindFromPath } from '@shared/media'

/** Debounce so a burst of fs events (e.g. copying many files in) yields one rebuild instead of one per file. */
const REBUILD_DEBOUNCE_MS = 250

function toMediaItem(folder: string, filename: string): MediaItem | null {
  const kind = mediaKindFromPath(filename)
  if (!kind) return null
  const ext = extname(filename)
  const path = join(folder, filename)
  try {
    const stat = statSync(path)
    return {
      path,
      name: basename(filename, ext),
      kind,
      mtimeMs: stat.mtimeMs
    }
  } catch {
    return null // file vanished between the fs event and this stat (race during copy/delete)
  }
}

interface WatchedFolder {
  watcher: FSWatcher
  debounceTimer: NodeJS.Timeout | null
}

/**
 * Watches only the folders currently referenced by media zones on the
 * active preset (set via `setActiveFolders`), broadcasting the current
 * `MediaItem[]` for a folder whenever its contents change. Folders that
 * fall out of use are unwatched, so switching presets/scenes doesn't leak
 * chokidar watchers over a long-running session.
 */
export class FolderSyncManager {
  private watched = new Map<string, WatchedFolder>()
  private onChange: (folder: string, items: MediaItem[]) => void

  constructor(onChange: (folder: string, items: MediaItem[]) => void) {
    this.onChange = onChange
  }

  setActiveFolders(folders: string[]): void {
    const wanted = new Set(folders)

    for (const [folder, entry] of this.watched) {
      if (!wanted.has(folder)) {
        if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
        entry.watcher.close()
        this.watched.delete(folder)
      }
    }

    for (const folder of wanted) {
      if (this.watched.has(folder)) continue
      this.startWatching(folder)
    }
  }

  stopAll(): void {
    for (const [, entry] of this.watched) {
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
      entry.watcher.close()
    }
    this.watched.clear()
  }

  private startWatching(folder: string): void {
    const watcher = chokidar.watch(folder, { depth: 0, ignoreInitial: false })
    const entry: WatchedFolder = { watcher, debounceTimer: null }
    this.watched.set(folder, entry)

    const scheduleRebuild = (): void => {
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
      entry.debounceTimer = setTimeout(() => this.rebuild(folder), REBUILD_DEBOUNCE_MS)
    }

    watcher.on('add', scheduleRebuild).on('unlink', scheduleRebuild).on('change', scheduleRebuild)
  }

  private async rebuild(folder: string): Promise<void> {
    const entry = this.watched.get(folder)
    if (!entry) return
    const watched = entry.watcher.getWatched()
    const filenames = watched[folder] ?? []
    const items = filenames
      .map((name) => toMediaItem(folder, name))
      .filter((item): item is MediaItem => item !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
    this.onChange(folder, items)
  }
}
