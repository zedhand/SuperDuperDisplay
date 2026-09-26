import { useRef, useState, type ReactElement } from 'react'
import type { Layout } from '@shared/types'
import { useConfigStore } from '../store/useConfigStore'

const SPLIT_OPTIONS: Array<{ id: Layout['split']; label: string }> = [
  { id: 'single', label: 'Full bleed' },
  { id: 'h', label: 'Split left / right' },
  { id: 'v', label: 'Split top / bottom' }
]

const MIN_RATIO = 0.1
const MAX_RATIO = 0.9

export function LayoutPage(): ReactElement {
  const config = useConfigStore((s) => s.config)
  const patch = useConfigStore((s) => s.patch)

  if (!config) return <div className="p-6 text-white/50">Loading…</div>

  const activePreset = config.presets.find((p) => p.id === config.activePresetId)
  const activeLayout = activePreset && config.layouts.find((l) => l.id === activePreset.layoutId)

  if (!activePreset || !activeLayout) {
    return <div className="p-6 text-white/50">No active preset.</div>
  }

  const layout: Layout = activeLayout

  // Layouts are shared by id across presets (e.g. the default "single"
  // layout backs both "Full-bleed loop" and "Black"). Mutating one in
  // place — which is what this editor otherwise does — would silently
  // reshape every other preset that happens to reference the same
  // layout. Clone it for this preset the moment more than one preset
  // relies on it, so editing here only ever affects the preset you're
  // looking at.
  function updateLayout(updater: (l: Layout) => Layout): void {
    if (!config || !activePreset) return
    const sharedWithOtherPresets = config.presets.some(
      (p) => p.id !== activePreset.id && p.layoutId === layout.id
    )
    if (sharedWithOtherPresets) {
      const cloned = updater({
        ...layout,
        id: crypto.randomUUID(),
        name: `${layout.name} (${activePreset.name})`
      })
      patch({
        layouts: [...config.layouts, cloned],
        presets: config.presets.map((p) =>
          p.id === activePreset.id ? { ...p, layoutId: cloned.id } : p
        )
      })
    } else {
      patch({ layouts: config.layouts.map((l) => (l.id === layout.id ? updater(l) : l)) })
    }
  }

  function setSplit(split: Layout['split']): void {
    updateLayout((l) => ({
      ...l,
      split,
      sizes: split === 'single' ? [1] : l.sizes.length === 2 ? l.sizes : [0.7, 0.3]
    }))
  }

  function setRatio(ratio: number): void {
    const clamped = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))
    updateLayout((l) => ({ ...l, sizes: [clamped, 1 - clamped] }))
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <section>
        <h2 className="mb-1 text-lg font-semibold text-white">Layout for {activePreset.name}</h2>
        <p className="mb-3 text-xs text-white/40">
          Switching presets on the Scenes page picks which one this editor is shaping.
        </p>
        <div className="flex gap-2">
          {SPLIT_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSplit(id)}
              className={`rounded-md border px-4 py-2 text-sm ${
                layout.split === id
                  ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-300'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {(layout.split === 'h' || layout.split === 'v') && layout.sizes.length === 2 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">Drag to resize</h2>
          <SplitPreview split={layout.split} sizes={layout.sizes} onRatioChange={setRatio} />
          <p className="mt-2 text-xs text-white/40">
            zone0: {Math.round(layout.sizes[0] * 100)}% · zone1: {Math.round(layout.sizes[1] * 100)}
            %
          </p>
        </section>
      )}
    </div>
  )
}

function SplitPreview({
  split,
  sizes,
  onRatioChange
}: {
  split: 'h' | 'v'
  sizes: number[]
  onRatioChange: (ratio: number) => void
}): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const isH = split === 'h'
  const ratio = sizes[0] / (sizes[0] + sizes[1])

  function handlePointerDown(e: React.PointerEvent): void {
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent): void {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const next = isH ? (e.clientX - rect.left) / rect.width : (e.clientY - rect.top) / rect.height
    onRatioChange(next)
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDragging(false)}
      className="relative h-40 w-full max-w-2xl overflow-hidden rounded-lg border border-white/10 bg-black"
      style={{ display: 'flex', flexDirection: isH ? 'row' : 'column' }}
    >
      <div
        className="flex items-center justify-center bg-fuchsia-500/10 text-xs text-fuchsia-300"
        style={{ flexBasis: `${ratio * 100}%` }}
      >
        zone0
      </div>
      <div
        onPointerDown={handlePointerDown}
        className={`shrink-0 bg-white/20 hover:bg-fuchsia-400/60 ${isH ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}`}
      />
      <div className="flex flex-1 items-center justify-center bg-white/5 text-xs text-white/50">
        zone1
      </div>
    </div>
  )
}
