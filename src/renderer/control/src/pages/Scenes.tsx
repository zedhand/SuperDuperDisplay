import { useEffect, useState, type ReactElement } from 'react'
import { File, FolderOpen } from 'lucide-react'
import type { FitMode, Preset, ZoneSource } from '@shared/types'
import { resolveZones } from '@shared/layout'
import { METRICS } from '@shared/telemetryMetrics'
import { useConfigStore } from '../store/useConfigStore'

const FIT_MODES: FitMode[] = ['cover', 'contain', 'stretch']
const STATS_STYLES: Array<'bars' | 'gauges' | 'compact'> = ['bars', 'gauges', 'compact']

function defaultMediaSource(source: { path?: string; folder?: string }): ZoneSource {
  return {
    type: 'media',
    ...source,
    shuffle: false,
    intervalSec: 8,
    fit: 'cover',
    bg: 'blur',
    bgColor: '#000000'
  }
}

const TYPE_SWITCH_OPTIONS: Array<{ label: string; make: () => ZoneSource }> = [
  { label: 'YouTube', make: () => ({ type: 'youtube', url: '' }) },
  { label: 'Web', make: () => ({ type: 'web', url: '' }) },
  {
    label: 'Stats',
    make: () => ({ type: 'stats', widgets: ['cpuTemp', 'gpuTemp'], style: 'bars' })
  },
  { label: 'Camera', make: () => ({ type: 'camera' }) },
  { label: 'Blank', make: () => ({ type: 'blank' }) }
]

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

  async function pickFileForZone(zoneId: string): Promise<void> {
    const path = await window.control.media.pickFile()
    if (path) setZoneSource(zoneId, defaultMediaSource({ path }))
  }

  async function pickFolderForZone(zoneId: string): Promise<void> {
    const folder = await window.control.media.pickFolder()
    if (folder) setZoneSource(zoneId, defaultMediaSource({ folder }))
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
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-medium text-white">{zone.zoneId}</div>
                    <div className="text-xs text-white/40">{source.type}</div>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => pickFileForZone(zone.zoneId)}
                      className="flex w-fit items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:border-white/20"
                    >
                      <File size={14} />
                      Media file…
                    </button>
                    <button
                      onClick={() => pickFolderForZone(zone.zoneId)}
                      className="flex w-fit items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:border-white/20"
                    >
                      <FolderOpen size={14} />
                      Media folder…
                    </button>
                    {TYPE_SWITCH_OPTIONS.map(({ label, make }) => (
                      <button
                        key={label}
                        onClick={() => setZoneSource(zone.zoneId, make())}
                        className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:border-white/20"
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {source.type === 'media' && (
                    <div className="flex flex-col gap-3">
                      <div className="truncate text-xs text-white/50">
                        {source.path ??
                          (source.folder ? `${source.folder} (folder)` : 'No media selected')}
                      </div>

                      {source.folder && (
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-xs text-white/70">
                            <input
                              type="checkbox"
                              checked={source.shuffle}
                              onChange={(e) =>
                                setZoneSource(zone.zoneId, { ...source, shuffle: e.target.checked })
                              }
                            />
                            Shuffle
                          </label>
                          <label className="flex items-center gap-2 text-xs text-white/70">
                            Every
                            <input
                              type="number"
                              min={1}
                              value={source.intervalSec}
                              onChange={(e) =>
                                setZoneSource(zone.zoneId, {
                                  ...source,
                                  intervalSec: Math.max(1, Number(e.target.value) || 1)
                                })
                              }
                              className="w-14 rounded border border-white/10 bg-white/5 px-2 py-1 text-white"
                            />
                            sec
                          </label>
                        </div>
                      )}

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

                  {source.type === 'youtube' && (
                    <UrlField
                      key={`${activePreset.id}-${zone.zoneId}`}
                      placeholder="https://www.youtube.com/watch?v=…"
                      value={source.url}
                      onCommit={(url) => setZoneSource(zone.zoneId, { type: 'youtube', url })}
                    />
                  )}

                  {source.type === 'web' && (
                    <UrlField
                      key={`${activePreset.id}-${zone.zoneId}`}
                      placeholder="https://example.com/dashboard"
                      value={source.url}
                      onCommit={(url) => setZoneSource(zone.zoneId, { ...source, url })}
                    />
                  )}

                  {source.type === 'stats' && (
                    <StatsEditor
                      widgets={source.widgets}
                      style={source.style}
                      onChange={(patch) => setZoneSource(zone.zoneId, { ...source, ...patch })}
                    />
                  )}

                  {source.type === 'camera' && (
                    <CameraEditor
                      deviceId={source.deviceId}
                      rtspUrl={source.rtspUrl}
                      onChange={(patch) => setZoneSource(zone.zoneId, { type: 'camera', ...patch })}
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

function UrlField({
  value,
  placeholder,
  onCommit
}: {
  value: string
  placeholder: string
  onCommit: (value: string) => void
}): ReactElement {
  const [draft, setDraft] = useState(value)

  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(draft)
      }}
      className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30"
    />
  )
}

function StatsEditor({
  widgets,
  style,
  onChange
}: {
  widgets: string[]
  style: 'bars' | 'gauges' | 'compact'
  onChange: (patch: { widgets?: string[]; style?: 'bars' | 'gauges' | 'compact' }) => void
}): ReactElement {
  function toggleWidget(key: string): void {
    const next = widgets.includes(key) ? widgets.filter((w) => w !== key) : [...widgets, key]
    onChange({ widgets: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {METRICS.map((metric) => (
          <button
            key={metric.key}
            onClick={() => toggleWidget(metric.key)}
            className={`rounded-md border px-3 py-1 text-xs ${
              widgets.includes(metric.key)
                ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-300'
                : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
            }`}
          >
            {metric.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {STATS_STYLES.map((s) => (
          <button
            key={s}
            onClick={() => onChange({ style: s })}
            className={`rounded-md border px-3 py-1 text-xs capitalize ${
              style === s
                ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-300'
                : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function CameraEditor({
  deviceId,
  rtspUrl,
  onChange
}: {
  deviceId?: string
  rtspUrl?: string
  onChange: (patch: { deviceId?: string; rtspUrl?: string }) => void
}): ReactElement {
  const mode = rtspUrl != null ? 'rtsp' : 'usb'
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadDevices(): Promise<void> {
      let list = await navigator.mediaDevices.enumerateDevices()
      const hasLabels = list.some((d) => d.kind === 'videoinput' && d.label)
      if (!hasLabels) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          stream.getTracks().forEach((track) => track.stop())
          list = await navigator.mediaDevices.enumerateDevices()
        } catch {
          // permission denied or no camera; fall back to unlabeled ids
        }
      }
      if (!cancelled) setDevices(list.filter((d) => d.kind === 'videoinput'))
    }

    loadDevices()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          onClick={() => onChange({ deviceId, rtspUrl: undefined })}
          className={`rounded-md border px-3 py-1 text-xs ${
            mode === 'usb'
              ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-300'
              : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
          }`}
        >
          USB webcam
        </button>
        <button
          onClick={() => onChange({ deviceId: undefined, rtspUrl: rtspUrl ?? '' })}
          className={`rounded-md border px-3 py-1 text-xs ${
            mode === 'rtsp'
              ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-300'
              : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
          }`}
        >
          RTSP
        </button>
      </div>

      {mode === 'usb' && (
        <select
          value={deviceId ?? ''}
          onChange={(e) => onChange({ deviceId: e.target.value || undefined, rtspUrl: undefined })}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="">System default</option>
          {devices.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Camera ${i + 1}`}
            </option>
          ))}
        </select>
      )}

      {mode === 'rtsp' && (
        <UrlField
          key="rtsp"
          placeholder="rtsp://user:pass@192.168.1.x:554/stream"
          value={rtspUrl ?? ''}
          onCommit={(url) => onChange({ deviceId: undefined, rtspUrl: url })}
        />
      )}
    </div>
  )
}
