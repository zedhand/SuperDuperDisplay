import { type ReactElement } from 'react'
import { FolderOpen } from 'lucide-react'
import type { FitMode, Preset, ZoneSource } from '@shared/types'
import { resolveZones } from '@shared/layout'
import { useConfigStore } from '../store/useConfigStore'

const FIT_MODES: FitMode[] = ['cover', 'contain', 'stretch']

function defaultMediaSource(path: string): ZoneSource {
  return {
    type: 'media',
    path,
    shuffle: false,
    intervalSec: 8,
    fit: 'cover',
    bg: 'blur',
    bgColor: '#000000'
  }
}

export function ScenesPage(): ReactElement {
  const config = useConfigStore((s) => s.config)
  const patch = useConfigStore((s) => s.patch)

  if (!config) return <div className="p-6 text-white/50">Loading…</div>

  const activePreset = config.presets.find((p) => p.id === config.activePresetId)
  const layout = activePreset && config.layouts.find((l) => l.id === activePreset.layoutId)
  const zones = activePreset && layout ? resolveZones(layout, activePreset.zones) : []

  function updatePreset(presetId: string, updater: (preset: Preset) => Preset): void {
    if (!config) return
    patch({ presets: config.presets.map((p) => (p.id === presetId ? updater(p) : p)) })
  }

  function setZoneSource(zoneId: string, source: ZoneSource): void {
    if (!activePreset) return
    updatePreset(activePreset.id, (p) => ({ ...p, zones: { ...p.zones, [zoneId]: source } }))
  }

  async function pickMediaForZone(zoneId: string): Promise<void> {
    const path = await window.control.media.pickFile()
    if (path) setZoneSource(zoneId, defaultMediaSource(path))
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Presets</h2>
        <div className="flex flex-wrap gap-2">
          {config.presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => patch({ activePresetId: preset.id })}
              className={`rounded-md border px-4 py-2 text-sm ${
                config.activePresetId === preset.id
                  ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-300'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </section>

      {activePreset && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">{activePreset.name} — zones</h2>
          <div className="flex flex-col gap-4">
            {zones.map((zone) => {
              const source = zone.source
              return (
                <div key={zone.zoneId} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium text-white">{zone.zoneId}</div>
                    <div className="text-xs text-white/40">{source.type}</div>
                  </div>

                  {source.type === 'media' && (
                    <div className="flex flex-col gap-3">
                      <div className="truncate text-xs text-white/50">
                        {source.path ?? source.folder ?? 'No media selected'}
                      </div>
                      <button
                        onClick={() => pickMediaForZone(zone.zoneId)}
                        className="flex w-fit items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:border-white/20"
                      >
                        <FolderOpen size={14} />
                        Pick file…
                      </button>

                      <div className="flex gap-2">
                        {FIT_MODES.map((fit) => (
                          <button
                            key={fit}
                            onClick={() => setZoneSource(zone.zoneId, { ...source, fit })}
                            className={`rounded-md border px-3 py-1 text-xs capitalize ${
                              source.fit === fit
                                ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-300'
                                : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                            }`}
                          >
                            {fit}
                          </button>
                        ))}
                      </div>

                      {source.fit === 'contain' && (
                        <div className="flex items-center gap-2">
                          {(['solid', 'blur'] as const).map((bg) => (
                            <button
                              key={bg}
                              onClick={() => setZoneSource(zone.zoneId, { ...source, bg })}
                              className={`rounded-md border px-3 py-1 text-xs capitalize ${
                                source.bg === bg
                                  ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-300'
                                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                              }`}
                            >
                              {bg} background
                            </button>
                          ))}
                          {source.bg === 'solid' && (
                            <input
                              type="color"
                              value={source.bgColor}
                              onChange={(e) =>
                                setZoneSource(zone.zoneId, { ...source, bgColor: e.target.value })
                              }
                              className="h-7 w-10 rounded border border-white/10 bg-transparent"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {source.type === 'blank' && (
                    <button
                      onClick={() => pickMediaForZone(zone.zoneId)}
                      className="flex w-fit items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:border-white/20"
                    >
                      <FolderOpen size={14} />
                      Pick file…
                    </button>
                  )}

                  {source.type !== 'media' && source.type !== 'blank' && (
                    <div className="text-xs text-white/40">Editable in a later phase.</div>
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
