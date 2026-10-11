import { useState, type ReactElement } from 'react'
import { Copy, Layers as LayersIcon, Maximize2, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Layout, Preset, ZoneSource } from '@shared/types'
import {
  computeAutoFitSizes,
  resolveZones,
  rotatedContentSize,
  updateLayoutForPreset
} from '@shared/layout'
import { useConfigStore } from '../store/useConfigStore'
import { useUndoStore } from '../store/useUndoStore'
import { ZoneSourceFields, ZoneTypeSwitcher } from '../components/ZoneEditors'
import { pushRecentMedia } from '../components/zoneDefaults'
import { LayersEditor } from '../components/LayersEditor'

const NEW_PRESET_LAYOUT: Omit<Layout, 'id'> = { name: 'Full bleed', split: 'single', sizes: [1] }

export function ScenesPage(): ReactElement {
  const config = useConfigStore((s) => s.config)
  const patch = useConfigStore((s) => s.patch)
  const [editingLayersZoneId, setEditingLayersZoneId] = useState<string | null>(null)

  if (!config) return <div className="p-6 text-[var(--text-4)]">Loading…</div>

  const activePreset = config.presets.find((p) => p.id === config.activePresetId)
  const layout = activePreset && config.layouts.find((l) => l.id === activePreset.layoutId)
  const zones = activePreset && layout ? resolveZones(layout, activePreset.zones) : []

  function updatePreset(presetId: string, updater: (preset: Preset) => Preset): void {
    if (!config) return
    patch({ presets: config.presets.map((p) => (p.id === presetId ? updater(p) : p)) })
  }

  function renamePreset(presetId: string, name: string): void {
    if (!name.trim()) return
    updatePreset(presetId, (p) => ({ ...p, name: name.trim() }))
  }

  function trackRecentMedia(path: string): void {
    if (!config) return
    patch({ recentMedia: pushRecentMedia(config.recentMedia, path) })
  }

  function createPreset(): void {
    if (!config) return
    const layout: Layout = { ...NEW_PRESET_LAYOUT, id: crypto.randomUUID() }
    const preset: Preset = {
      id: crypto.randomUUID(),
      name: 'New scene',
      layoutId: layout.id,
      zones: { zone0: { type: 'blank' } },
      colorProfileId: config.colorProfiles[0]?.id ?? 'neutral',
      fit: 'cover'
    }
    patch({
      layouts: [...config.layouts, layout],
      presets: [...config.presets, preset],
      activePresetId: preset.id
    })
  }

  // Duplicates get their own clone of the source layout (not a shared
  // reference) so experimenting with a duplicate's split/sizes can never
  // affect the original — the same clone-on-write principle
  // `updateLayoutForPreset` applies on edit, just applied eagerly here since
  // a fresh duplicate is definitionally not yet shared with anything.
  function duplicatePreset(preset: Preset): void {
    if (!config) return
    const sourceLayout = config.layouts.find((l) => l.id === preset.layoutId)
    const newLayout: Layout | null = sourceLayout
      ? { ...sourceLayout, id: crypto.randomUUID() }
      : null
    const newPreset: Preset = {
      ...preset,
      id: crypto.randomUUID(),
      name: `${preset.name} copy`,
      layoutId: newLayout?.id ?? preset.layoutId
    }
    patch({
      layouts: newLayout ? [...config.layouts, newLayout] : config.layouts,
      presets: [...config.presets, newPreset]
    })
  }

  function deletePreset(presetId: string): void {
    if (!config || config.presets.length <= 1) return
    const target = config.presets.find((p) => p.id === presetId)
    if (!target) return
    const previousPresets = config.presets
    const previousLayouts = config.layouts
    const previousActivePresetId = config.activePresetId
    const remainingPresets = config.presets.filter((p) => p.id !== presetId)
    const layoutStillUsed = remainingPresets.some((p) => p.layoutId === target.layoutId)
    patch({
      presets: remainingPresets,
      layouts: layoutStillUsed
        ? config.layouts
        : config.layouts.filter((l) => l.id !== target.layoutId),
      activePresetId:
        config.activePresetId === presetId ? remainingPresets[0].id : config.activePresetId
    })
    useUndoStore.getState().offer(`Deleted scene "${target.name}"`, () =>
      patch({
        presets: previousPresets,
        layouts: previousLayouts,
        activePresetId: previousActivePresetId
      })
    )
  }

  function setZoneSource(zoneId: string, source: ZoneSource): void {
    if (!activePreset) return
    updatePreset(activePreset.id, (p) => ({ ...p, zones: { ...p.zones, [zoneId]: source } }))
  }

  /**
   * Reads the zone's currently-playing video/image's real pixel dimensions
   * straight off the display window (the control window never renders
   * actual media itself), then resizes the layout's `h`/`v` split so this
   * zone's box matches that aspect ratio exactly — no cropping needed
   * regardless of the zone's own `fit` mode. No-ops quietly for
   * `single`/`grid` layouts (every zone is already full-bleed, nothing to
   * resize) or when nothing has loaded yet to measure.
   */
  async function autoFitZone(zoneId: string, zoneIndex: number): Promise<void> {
    if (!config || !activePreset || !layout) return
    const natural = await window.control.zone.getNaturalSize(zoneId)
    if (!natural || !config.display.match) return
    const contentSize = rotatedContentSize(config.display.match, config.display.rotation)
    const newSizes = computeAutoFitSizes(
      layout,
      zoneIndex,
      natural.width / natural.height,
      contentSize
    )
    if (!newSizes) return
    patch(updateLayoutForPreset(config, activePreset, layout, (l) => ({ ...l, sizes: newSizes })))
  }

  const editingZone = editingLayersZoneId && zones.find((z) => z.zoneId === editingLayersZoneId)
  if (editingZone && editingZone.source.type === 'layers') {
    return (
      <LayersEditor
        zoneId={editingZone.zoneId}
        items={editingZone.source.items}
        onChange={(items) => setZoneSource(editingZone.zoneId, { type: 'layers', items })}
        onBack={() => setEditingLayersZoneId(null)}
        recentMedia={config.recentMedia}
        onMediaPicked={trackRecentMedia}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-1)]">Scenes</h2>
        <div className="flex flex-wrap items-center gap-2">
          {config.presets.map((preset) => (
            <PresetChip
              key={preset.id}
              preset={preset}
              active={config.activePresetId === preset.id}
              canDelete={config.presets.length > 1}
              onActivate={() => patch({ activePresetId: preset.id })}
              onRename={(name) => renamePreset(preset.id, name)}
              onDuplicate={() => duplicatePreset(preset)}
              onDelete={() => deletePreset(preset.id)}
            />
          ))}
          <button
            onClick={createPreset}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-3)] hover:border-[var(--border-2)]"
          >
            <Plus size={14} />
            New
          </button>
        </div>
      </section>

      {activePreset && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--text-1)]">
            {activePreset.name} — zones
          </h2>
          <div className="flex flex-col gap-4">
            {zones.map((zone, zoneIndex) => {
              const source = zone.source
              const canAutoFit =
                (layout?.split === 'h' || layout?.split === 'v') &&
                source.type === 'media' &&
                !source.folder
              return (
                <div
                  key={zone.zoneId}
                  className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-medium text-[var(--text-1)]">{zone.zoneId}</div>
                    <div className="text-xs text-[var(--text-5)]">{source.type}</div>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <ZoneTypeSwitcher
                      onPick={(s) => setZoneSource(zone.zoneId, s)}
                      recentMedia={config.recentMedia}
                      onMediaPicked={trackRecentMedia}
                    />
                    <button
                      onClick={() => setZoneSource(zone.zoneId, { type: 'layers', items: [] })}
                      className="flex items-center gap-2 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:border-[var(--border-2)]"
                    >
                      <LayersIcon size={14} />
                      Layers
                    </button>
                  </div>

                  {source.type === 'layers' ? (
                    <button
                      onClick={() => setEditingLayersZoneId(zone.zoneId)}
                      className="flex items-center gap-2 rounded-md border border-[var(--accent-border-soft)] bg-[var(--accent-bg)] px-3 py-2 text-xs text-[var(--accent-light)] hover:border-[var(--accent-border)]"
                    >
                      <Maximize2 size={14} />
                      {source.items.length} layer{source.items.length === 1 ? '' : 's'} — Edit
                      layers →
                    </button>
                  ) : (
                    <ZoneSourceFields
                      key={zone.zoneId}
                      source={source}
                      onChange={(s) => setZoneSource(zone.zoneId, s)}
                      autoFit={{
                        available: canAutoFit,
                        onClick: () => autoFitZone(zone.zoneId, zoneIndex)
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function PresetChip({
  preset,
  active,
  canDelete,
  onActivate,
  onRename,
  onDuplicate,
  onDelete
}: {
  preset: Preset
  active: boolean
  canDelete: boolean
  onActivate: () => void
  onRename: (name: string) => void
  onDuplicate: () => void
  onDelete: () => void
}): ReactElement {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(preset.name)

  if (renaming) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onRename(draft)
          setRenaming(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onRename(draft)
            setRenaming(false)
          }
          if (e.key === 'Escape') {
            setDraft(preset.name)
            setRenaming(false)
          }
        }}
        className="rounded-md border border-[var(--accent-border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-1)]"
      />
    )
  }

  return (
    <div
      className={`flex items-center gap-1 rounded-md border pl-4 pr-1.5 py-1 text-sm ${
        active
          ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
          : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
      }`}
    >
      <button onClick={onActivate} className="py-1">
        {preset.name}
      </button>
      <button
        onClick={() => {
          setDraft(preset.name)
          setRenaming(true)
        }}
        className="rounded p-1 hover:bg-[var(--surface-2)]"
        title="Rename"
      >
        <Pencil size={12} />
      </button>
      <button
        onClick={onDuplicate}
        className="rounded p-1 hover:bg-[var(--surface-2)]"
        title="Duplicate"
      >
        <Copy size={12} />
      </button>
      {canDelete && (
        <button
          onClick={onDelete}
          className="rounded p-1 hover:bg-[var(--surface-2)]"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}
