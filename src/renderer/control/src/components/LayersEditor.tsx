import { useRef, useState, type PointerEvent, type ReactElement } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, Plus, Trash2 } from 'lucide-react'
import type { LayerFilter, LayerItem, ZoneSource } from '@shared/types'
import { layerFilterCss } from '@shared/layerFilter'
import { ZoneRenderer } from '@display/zones/ZoneRenderer'
import { ZoneSourceFields } from './ZoneEditors'
import { defaultMediaSource, TYPE_SWITCH_OPTIONS } from './zoneDefaults'
import { useUndoStore } from '../store/useUndoStore'

const LAYER_FILTERS: LayerFilter[] = ['none', 'grayscale', 'sepia', 'blur', 'invert']

const MIN_FRACTION = 0.05
const DEFAULT_SIZE = 0.4

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sourceLabel(source: ZoneSource): string {
  if (source.type === 'media') return source.path?.split(/[/\\]/).pop() ?? source.folder ?? 'Media'
  if (source.type === 'nowplaying') return 'Now Playing'
  return source.type[0].toUpperCase() + source.type.slice(1)
}

function nextZIndex(items: LayerItem[]): number {
  return items.length === 0 ? 0 : Math.max(...items.map((i) => i.zIndex)) + 1
}

/**
 * Drag-and-scale canvas editor for a `layers` zone. Each layer is an
 * arbitrary `ZoneSource` in a free-form box — a YouTube layer and a GIF
 * layer are the same mechanism here, just a different `source.type` (see
 * PLAN.md's "OBS Scenes/Sources model" section).
 *
 * The canvas shows a real `<img>`/`<video>` preview for media layers
 * (`media://` is registered app-wide, so the control window can load the
 * actual file) and a labeled placeholder for every other source type —
 * deliberately not the full `ZoneRenderer` here, since several zone
 * components (stats, RTSP camera, folder playlists) read `window.display.*`
 * preload APIs that only exist in the display window's context and would
 * throw if rendered in the control window. Position/size/opacity are still
 * fully real and apply exactly as configured on the actual display; only
 * the *editor's own preview* is simplified for those types.
 */
export function LayersEditor({
  zoneId,
  items,
  onChange,
  onBack,
  recentMedia,
  onMediaPicked
}: {
  zoneId: string
  items: LayerItem[]
  onChange: (items: LayerItem[]) => void
  onBack: () => void
  recentMedia?: string[]
  onMediaPicked?: (path: string) => void
}): ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const selected = items.find((i) => i.id === selectedId) ?? null

  function updateLayer(id: string, patch: Partial<LayerItem>): void {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function addLayer(source: ZoneSource): void {
    const id = crypto.randomUUID()
    const size = DEFAULT_SIZE
    onChange([
      ...items,
      {
        id,
        x: (1 - size) / 2,
        y: (1 - size) / 2,
        width: size,
        height: size,
        opacity: 1,
        zIndex: nextZIndex(items),
        filter: 'none',
        source
      }
    ])
    setSelectedId(id)
    setAddMenuOpen(false)
  }

  async function addMediaLayer(kind: 'file' | 'folder'): Promise<void> {
    const path = kind === 'file' ? await window.control.media.pickFile() : null
    const folder = kind === 'folder' ? await window.control.media.pickFolder() : null
    if (!path && !folder) return
    addLayer(defaultMediaSource(path ? { path } : { folder: folder! }))
    if (path) onMediaPicked?.(path)
  }

  function addRecentMediaLayer(path: string): void {
    addLayer(defaultMediaSource({ path }))
    onMediaPicked?.(path)
  }

  function removeLayer(id: string): void {
    const removed = items.find((i) => i.id === id)
    const previousItems = items
    onChange(items.filter((i) => i.id !== id))
    if (selectedId === id) setSelectedId(null)
    if (removed) {
      useUndoStore
        .getState()
        .offer(`Removed layer "${sourceLabel(removed.source)}"`, () => onChange(previousItems))
    }
  }

  function reorder(id: string, direction: 'up' | 'down'): void {
    const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex)
    const index = sorted.findIndex((i) => i.id === id)
    const swapWith = direction === 'up' ? index + 1 : index - 1
    if (swapWith < 0 || swapWith >= sorted.length) return
    const a = sorted[index]
    const b = sorted[swapWith]
    onChange(
      items.map((i) =>
        i.id === a.id ? { ...i, zIndex: b.zIndex } : i.id === b.id ? { ...i, zIndex: a.zIndex } : i
      )
    )
  }

  function handleDragBody(e: PointerEvent<HTMLDivElement>, layer: LayerItem): void {
    e.stopPropagation()
    setSelectedId(layer.id)
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const originX = layer.x
    const originY = layer.y
    e.currentTarget.setPointerCapture(e.pointerId)

    function onMove(ev: globalThis.PointerEvent): void {
      const dx = (ev.clientX - startX) / rect.width
      const dy = (ev.clientY - startY) / rect.height
      updateLayer(layer.id, {
        x: clamp(originX + dx, 0, 1 - layer.width),
        y: clamp(originY + dy, 0, 1 - layer.height)
      })
    }
    function onUp(): void {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function handleResize(e: PointerEvent<HTMLDivElement>, layer: LayerItem): void {
    e.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const originW = layer.width
    const originH = layer.height
    e.currentTarget.setPointerCapture(e.pointerId)

    function onMove(ev: globalThis.PointerEvent): void {
      const dx = (ev.clientX - startX) / rect.width
      const dy = (ev.clientY - startY) / rect.height
      updateLayer(layer.id, {
        width: clamp(originW + dx, MIN_FRACTION, 1 - layer.x),
        height: clamp(originH + dy, MIN_FRACTION, 1 - layer.y)
      })
    }
    function onUp(): void {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const sortedForList = [...items].sort((a, b) => b.zIndex - a.zIndex)

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text-1)]"
        >
          <ChevronLeft size={16} />
          Back to zones
        </button>
        <div className="text-sm font-medium text-[var(--text-1)]">{zoneId} — Layers</div>
        <div className="relative">
          <button
            onClick={() => setAddMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-[var(--accent-border-soft)] bg-[var(--accent-bg)] px-3 py-1.5 text-xs text-[var(--accent-light)] hover:border-[var(--accent-border)]"
          >
            <Plus size={14} />
            Add
          </button>
          {addMenuOpen && (
            <div className="absolute right-0 z-10 mt-1 flex w-48 flex-col gap-1 rounded-md border border-[var(--border-1)] bg-[var(--surface-popover)] p-2 shadow-xl">
              <button
                onClick={() => addMediaLayer('file')}
                className="rounded px-2 py-1.5 text-left text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)]"
              >
                Media file…
              </button>
              <button
                onClick={() => addMediaLayer('folder')}
                className="rounded px-2 py-1.5 text-left text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)]"
              >
                Media folder…
              </button>
              {recentMedia && recentMedia.length > 0 && (
                <>
                  <div className="my-1 border-t border-[var(--border-1)]" />
                  <div className="px-2 text-[10px] uppercase tracking-wide text-[var(--text-6)]">
                    Recent
                  </div>
                  {recentMedia.slice(0, 5).map((path) => (
                    <button
                      key={path}
                      onClick={() => {
                        addRecentMediaLayer(path)
                        setAddMenuOpen(false)
                      }}
                      title={path}
                      className="truncate rounded px-2 py-1.5 text-left text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                    >
                      {path.split(/[/\\]/).pop()}
                    </button>
                  ))}
                  <div className="my-1 border-t border-[var(--border-1)]" />
                </>
              )}
              {TYPE_SWITCH_OPTIONS.filter((o) => o.label !== 'Blank').map(({ label, make }) => (
                <button
                  key={label}
                  onClick={() => addLayer(make())}
                  className="rounded px-2 py-1.5 text-left text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div
          ref={canvasRef}
          onPointerDown={() => setSelectedId(null)}
          className="relative flex-1 overflow-hidden rounded-lg border border-[var(--border-1)] bg-black"
        >
          {[...items]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((layer) => (
              <div
                key={layer.id}
                style={{
                  position: 'absolute',
                  left: `${layer.x * 100}%`,
                  top: `${layer.y * 100}%`,
                  width: `${layer.width * 100}%`,
                  height: `${layer.height * 100}%`,
                  opacity: layer.opacity,
                  outline:
                    layer.id === selectedId
                      ? '2px solid #e879f9'
                      : '1px dashed rgba(255,255,255,0.25)'
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    filter: layerFilterCss(layer.filter)
                  }}
                >
                  <ZoneRenderer
                    zone={{
                      zoneId: layer.id,
                      rect: { xPct: layer.x, yPct: layer.y, wPct: layer.width, hPct: layer.height },
                      source: layer.source
                    }}
                    isPreview
                  />
                </div>
                {/* Transparent hit-layer on top of the real preview content (a live
                    webview can swallow pointer events meant for dragging otherwise). */}
                <div
                  onPointerDown={(e) => handleDragBody(e, layer)}
                  style={{ position: 'absolute', inset: 0, cursor: 'move' }}
                />
                {layer.id === selectedId && (
                  <div
                    onPointerDown={(e) => handleResize(e, layer)}
                    style={{
                      position: 'absolute',
                      right: -6,
                      bottom: -6,
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: '#e879f9',
                      cursor: 'nwse-resize'
                    }}
                  />
                )}
              </div>
            ))}
        </div>

        <div className="flex w-72 flex-col gap-4 overflow-y-auto">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-5)]">
              Layers
            </h3>
            <div className="flex flex-col gap-1">
              {sortedForList.length === 0 && (
                <p className="text-xs text-[var(--text-5)]">No layers yet — click Add.</p>
              )}
              {sortedForList.map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => setSelectedId(layer.id)}
                  className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                    layer.id === selectedId
                      ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                      : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
                  }`}
                >
                  <span className="truncate">{sourceLabel(layer.source)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        reorder(layer.id, 'up')
                      }}
                      className="rounded p-1 hover:bg-[var(--surface-2)]"
                      title="Bring forward"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        reorder(layer.id, 'down')
                      }}
                      className="rounded p-1 hover:bg-[var(--surface-2)]"
                      title="Send backward"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeLayer(layer.id)
                      }}
                      className="rounded p-1 hover:bg-[var(--surface-2)]"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selected && (
            <div className="flex flex-col gap-3 border-t border-[var(--border-1)] pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-5)]">
                {sourceLabel(selected.source)}
              </h3>
              <div className="flex items-center gap-3">
                <span className="w-14 text-xs text-[var(--text-4)]">Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selected.opacity * 100)}
                  onChange={(e) =>
                    updateLayer(selected.id, { opacity: Number(e.target.value) / 100 })
                  }
                  className="flex-1"
                />
                <span className="w-9 text-right text-xs text-[var(--text-4)]">
                  {Math.round(selected.opacity * 100)}%
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-14 text-xs text-[var(--text-4)]">Filter</span>
                {LAYER_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => updateLayer(selected.id, { filter })}
                    className={`rounded-md border px-2.5 py-1 text-xs capitalize ${
                      selected.filter === filter
                        ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                        : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <ZoneSourceFields
                key={selected.id}
                source={selected.source}
                onChange={(source) => updateLayer(selected.id, { source })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
