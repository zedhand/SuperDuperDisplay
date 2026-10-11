import { useEffect, useRef, useState, type ReactElement } from 'react'
import { File, FolderOpen, Maximize2 } from 'lucide-react'
import type { ZoneSource } from '@shared/types'
import { METRICS } from '@shared/telemetryMetrics'
import { mediaKindFromPath, toMediaUrl } from '@shared/media'
import { defaultMediaSource, FIT_MODES, STATS_STYLES, TYPE_SWITCH_OPTIONS } from './zoneDefaults'

/**
 * `binaryOnly` renders a mute/unmute toggle instead of a slider — a
 * webview (the Web zone) only supports `setAudioMuted()`, a boolean, so a
 * slider position other than 0%/100% would be misleading about what the
 * value actually controls.
 */
export function VolumeSlider({
  volume,
  onChange,
  binaryOnly
}: {
  volume: number
  onChange: (volume: number) => void
  binaryOnly?: boolean
}): ReactElement {
  if (binaryOnly) {
    return (
      <label className="flex w-fit items-center gap-2 text-xs text-[var(--text-3)]">
        <input
          type="checkbox"
          checked={volume > 0}
          onChange={(e) => onChange(e.target.checked ? 1 : 0)}
        />
        Unmuted
      </label>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-xs text-[var(--text-4)]">Volume</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-40"
      />
      <span className="w-9 text-right text-xs text-[var(--text-4)]">
        {Math.round(volume * 100)}%
      </span>
    </div>
  )
}

export function UrlField({
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
      className="w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-6)]"
    />
  )
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/**
 * A scrubbable video preview + trim in/out points + loop toggle, for a
 * single-file media zone's video. Loads the same real file via the
 * `media://` protocol (registered app-wide, so this works fine in the
 * control renderer, not just the display window) rather than faking
 * playback controls — scrubbing the range input actually seeks the preview
 * so you can see the frame at a point before committing it as a trim point.
 *
 * `duration`/`scrubTime` need to reset whenever `path` changes (a different
 * file was picked) — the caller passes `key={path}` so React remounts this
 * component with fresh state on a file change, the documented pattern for
 * "reset state when a prop changes" (rather than an effect calling
 * setState, which this project's `react-hooks/set-state-in-effect` rule
 * flags, and rightly — remounting is simpler and avoids an extra render).
 */
export function MediaTrimEditor({
  path,
  loop,
  trimStart,
  trimEnd,
  onChange
}: {
  path: string
  loop: boolean
  trimStart?: number
  trimEnd?: number
  onChange: (patch: { loop?: boolean; trimStart?: number; trimEnd?: number }) => void
}): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [scrubTime, setScrubTime] = useState(trimStart ?? 0)

  function seekTo(t: number): void {
    setScrubTime(t)
    if (videoRef.current) videoRef.current.currentTime = t
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--border-1)] bg-[var(--surface-0)] p-3">
      <video
        ref={videoRef}
        src={toMediaUrl(path)}
        muted
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          setDuration(d)
          seekTo(Math.min(scrubTime, d))
        }}
        className="max-h-32 w-full rounded bg-black object-contain"
      />
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={scrubTime}
        onChange={(e) => seekTo(Number(e.target.value))}
        disabled={!duration}
        className="w-full"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-4)]">
        <span className="tabular-nums">
          {formatSeconds(scrubTime)} / {formatSeconds(duration)}
        </span>
        <button
          onClick={() => onChange({ trimStart: scrubTime })}
          className="rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-2)] hover:border-[var(--border-2)]"
        >
          Set start here
        </button>
        <button
          onClick={() => onChange({ trimEnd: scrubTime })}
          className="rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-2)] hover:border-[var(--border-2)]"
        >
          Set end here
        </button>
        {(trimStart != null || trimEnd != null) && (
          <button
            onClick={() => onChange({ trimStart: undefined, trimEnd: undefined })}
            className="rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-2)] hover:border-[var(--border-2)]"
          >
            Clear trim
          </button>
        )}
      </div>
      <div className="text-[11px] text-[var(--text-5)]">
        Loop range: {trimStart != null ? formatSeconds(trimStart) : 'start'} –{' '}
        {trimEnd != null ? formatSeconds(trimEnd) : 'end'}
      </div>
      <label className="flex w-fit items-center gap-2 text-xs text-[var(--text-3)]">
        <input
          type="checkbox"
          checked={loop}
          onChange={(e) => onChange({ loop: e.target.checked })}
        />
        Loop
      </label>
    </div>
  )
}

export function StatsEditor({
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
                ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
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
                ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CameraEditor({
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
              ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
              : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
          }`}
        >
          USB webcam
        </button>
        <button
          onClick={() => onChange({ deviceId: undefined, rtspUrl: rtspUrl ?? '' })}
          className={`rounded-md border px-3 py-1 text-xs ${
            mode === 'rtsp'
              ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
              : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
          }`}
        >
          RTSP
        </button>
      </div>

      {mode === 'usb' && (
        <select
          value={deviceId ?? ''}
          onChange={(e) => onChange({ deviceId: e.target.value || undefined, rtspUrl: undefined })}
          className="w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-1)]"
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

const ALIGN_OPTIONS: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right']

export function ClockEditor({
  format,
  showDate,
  color,
  align,
  onChange
}: {
  format: '12h' | '24h'
  showDate: boolean
  color: string
  align: 'left' | 'center' | 'right'
  onChange: (patch: {
    format?: '12h' | '24h'
    showDate?: boolean
    color?: string
    align?: 'left' | 'center' | 'right'
  }) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(['12h', '24h'] as const).map((f) => (
          <button
            key={f}
            onClick={() => onChange({ format: f })}
            className={`rounded-md border px-3 py-1 text-xs ${
              format === f
                ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
            }`}
          >
            {f}
          </button>
        ))}
        {ALIGN_OPTIONS.map((a) => (
          <button
            key={a}
            onClick={() => onChange({ align: a })}
            className={`rounded-md border px-3 py-1 text-xs capitalize ${
              align === a
                ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--text-3)]">
          <input
            type="checkbox"
            checked={showDate}
            onChange={(e) => onChange({ showDate: e.target.checked })}
          />
          Show date
        </label>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-7 w-10 rounded border border-[var(--border-1)] bg-transparent"
        />
      </div>
    </div>
  )
}

export function CalendarEditor({
  accentColor,
  mode,
  icsUrl,
  onChange
}: {
  accentColor: string
  mode: 'grid' | 'agenda'
  icsUrl?: string
  onChange: (patch: { accentColor?: string; mode?: 'grid' | 'agenda'; icsUrl?: string }) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(['grid', 'agenda'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onChange({ mode: m })}
            className={`rounded-md border px-3 py-1 text-xs capitalize ${
              mode === m
                ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
            }`}
          >
            {m === 'grid' ? 'Month grid' : 'Agenda (.ics feed)'}
          </button>
        ))}
      </div>
      {mode === 'agenda' && (
        <div className="flex flex-col gap-1.5">
          <UrlField
            placeholder="https://…/basic.ics"
            value={icsUrl ?? ''}
            onCommit={(url) => onChange({ icsUrl: url })}
          />
          <p className="text-[11px] leading-snug text-[var(--text-5)]">
            Paste your calendar&apos;s secret iCal address — no account sign-in needed. Google
            Calendar: Settings → your calendar → &quot;Secret address in iCal format&quot;. Outlook:
            Share calendar → Publish → ICS link. Apple Calendar: Share Calendar → Public Calendar
            link.
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-4)]">
          {mode === 'grid' ? 'Today highlight' : 'Accent color'}
        </span>
        <input
          type="color"
          value={accentColor}
          onChange={(e) => onChange({ accentColor: e.target.value })}
          className="h-7 w-10 rounded border border-[var(--border-1)] bg-transparent"
        />
      </div>
    </div>
  )
}

export function NowPlayingEditor({
  color,
  align,
  onChange
}: {
  color: string
  align: 'left' | 'center' | 'right'
  onChange: (patch: { color?: string; align?: 'left' | 'center' | 'right' }) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {ALIGN_OPTIONS.map((a) => (
          <button
            key={a}
            onClick={() => onChange({ align: a })}
            className={`rounded-md border px-3 py-1 text-xs capitalize ${
              align === a
                ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-4)]">Text color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-7 w-10 rounded border border-[var(--border-1)] bg-transparent"
        />
      </div>
      <p className="text-[11px] leading-snug text-[var(--text-5)]">
        Shows whatever&apos;s currently playing in any app on this machine (Spotify, a browser tab,
        etc.) — reads Windows&apos; own &quot;now playing&quot; info, not tied to this app&apos;s
        own media zones.
      </p>
    </div>
  )
}

export function TextEditor({
  content,
  color,
  align,
  scale,
  bold,
  onChange
}: {
  content: string
  color: string
  align: 'left' | 'center' | 'right'
  scale: number
  bold: boolean
  onChange: (patch: {
    content?: string
    color?: string
    align?: 'left' | 'center' | 'right'
    scale?: number
    bold?: boolean
  }) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={content}
        onChange={(e) => onChange({ content: e.target.value })}
        rows={2}
        className="w-full rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-6)]"
        placeholder="Text to display"
      />
      <div className="flex flex-wrap items-center gap-2">
        {ALIGN_OPTIONS.map((a) => (
          <button
            key={a}
            onClick={() => onChange({ align: a })}
            className={`rounded-md border px-3 py-1 text-xs capitalize ${
              align === a
                ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
            }`}
          >
            {a}
          </button>
        ))}
        <label className="flex items-center gap-2 text-xs text-[var(--text-3)]">
          <input
            type="checkbox"
            checked={bold}
            onChange={(e) => onChange({ bold: e.target.checked })}
          />
          Bold
        </label>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-7 w-10 rounded border border-[var(--border-1)] bg-transparent"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="w-12 text-xs text-[var(--text-4)]">Size</span>
        <input
          type="range"
          min={50}
          max={200}
          value={Math.round(scale * 100)}
          onChange={(e) => onChange({ scale: Number(e.target.value) / 100 })}
          className="w-40"
        />
        <span className="w-9 text-right text-xs text-[var(--text-4)]">
          {Math.round(scale * 100)}%
        </span>
      </div>
    </div>
  )
}

export function ColorEditor({
  mode,
  colorA,
  colorB,
  angle,
  onChange
}: {
  mode: 'solid' | 'gradient'
  colorA: string
  colorB: string
  angle: number
  onChange: (patch: {
    mode?: 'solid' | 'gradient'
    colorA?: string
    colorB?: string
    angle?: number
  }) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(['solid', 'gradient'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onChange({ mode: m })}
            className={`rounded-md border px-3 py-1 text-xs capitalize ${
              mode === m
                ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={colorA}
          onChange={(e) => onChange({ colorA: e.target.value })}
          className="h-7 w-10 rounded border border-[var(--border-1)] bg-transparent"
        />
        {mode === 'gradient' && (
          <>
            <input
              type="color"
              value={colorB}
              onChange={(e) => onChange({ colorB: e.target.value })}
              className="h-7 w-10 rounded border border-[var(--border-1)] bg-transparent"
            />
            <input
              type="number"
              value={angle}
              onChange={(e) => onChange({ angle: Number(e.target.value) || 0 })}
              className="w-16 rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-1)]"
            />
            <span className="text-xs text-[var(--text-4)]">deg</span>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * A small dropdown of previously-picked media file paths — lets reusing a
 * file skip the OS file dialog entirely. Shown only when there's at least
 * one recent entry.
 */
function RecentMediaMenu({
  recentMedia,
  onPick
}: {
  recentMedia: string[]
  onPick: (path: string) => void
}): ReactElement | null {
  const [open, setOpen] = useState(false)
  if (recentMedia.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-fit items-center gap-2 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:border-[var(--border-2)]"
      >
        Recent ▾
      </button>
      {open && (
        <div className="absolute left-0 z-10 mt-1 flex max-h-64 w-72 flex-col gap-0.5 overflow-y-auto rounded-md border border-[var(--border-1)] bg-[var(--surface-popover)] p-1.5 shadow-xl">
          {recentMedia.map((path) => (
            <button
              key={path}
              onClick={() => {
                onPick(path)
                setOpen(false)
              }}
              title={path}
              className="truncate rounded px-2 py-1.5 text-left text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            >
              {path.split(/[/\\]/).pop()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The row of buttons that sets a zone's (or layer's) type — reused by the
 * top-level Scenes zone card and the layers-canvas "+ Add"/per-layer type
 * switcher, since both are "pick what kind of thing this slot shows."
 * `recentMedia`/`onMediaPicked` are optional since the layers-canvas "+ Add"
 * menu doesn't currently thread recent-media tracking through (a smaller
 * follow-up, not core to either feature).
 */
export function ZoneTypeSwitcher({
  onPick,
  recentMedia,
  onMediaPicked
}: {
  onPick: (source: ZoneSource) => void
  recentMedia?: string[]
  onMediaPicked?: (path: string) => void
}): ReactElement {
  async function pickFile(): Promise<void> {
    const path = await window.control.media.pickFile()
    if (path) {
      onPick(defaultMediaSource({ path }))
      onMediaPicked?.(path)
    }
  }
  async function pickFolder(): Promise<void> {
    const folder = await window.control.media.pickFolder()
    if (folder) onPick(defaultMediaSource({ folder }))
  }
  function pickRecent(path: string): void {
    onPick(defaultMediaSource({ path }))
    onMediaPicked?.(path)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={pickFile}
        className="flex w-fit items-center gap-2 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:border-[var(--border-2)]"
      >
        <File size={14} />
        Media file…
      </button>
      <button
        onClick={pickFolder}
        className="flex w-fit items-center gap-2 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:border-[var(--border-2)]"
      >
        <FolderOpen size={14} />
        Media folder…
      </button>
      {recentMedia && <RecentMediaMenu recentMedia={recentMedia} onPick={pickRecent} />}
      {TYPE_SWITCH_OPTIONS.map(({ label, make }) => (
        <button
          key={label}
          onClick={() => onPick(make())}
          className="rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:border-[var(--border-2)]"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * Renders whichever detail editor matches `source.type` — the single
 * dispatcher both the top-level Scenes zone card and the layers-canvas
 * per-layer inspector use, so improving one type's editor improves it
 * everywhere that type can appear. `autoFit` is optional since it only
 * makes sense for a top-level zone inside an `h`/`v` split, not (yet) for
 * a freeform layer.
 */
export function ZoneSourceFields({
  source,
  onChange,
  autoFit
}: {
  source: ZoneSource
  onChange: (source: ZoneSource) => void
  autoFit?: { available: boolean; onClick: () => void }
}): ReactElement | null {
  switch (source.type) {
    case 'media':
      return (
        <div className="flex flex-col gap-3">
          <div className="truncate text-xs text-[var(--text-4)]">
            {source.path ?? (source.folder ? `${source.folder} (folder)` : 'No media selected')}
          </div>

          {source.folder && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[var(--text-3)]">
                <input
                  type="checkbox"
                  checked={source.shuffle}
                  onChange={(e) => onChange({ ...source, shuffle: e.target.checked })}
                />
                Shuffle
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--text-3)]">
                Every
                <input
                  type="number"
                  min={1}
                  value={source.intervalSec}
                  onChange={(e) =>
                    onChange({ ...source, intervalSec: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="w-14 rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-1)]"
                />
                sec
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {FIT_MODES.map((fit) => (
              <button
                key={fit}
                onClick={() => onChange({ ...source, fit })}
                className={`rounded-md border px-3 py-1 text-xs capitalize ${
                  source.fit === fit
                    ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                    : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
                }`}
              >
                {fit}
              </button>
            ))}
            {autoFit?.available && (
              <button
                onClick={autoFit.onClick}
                title="Resizes to exactly match this video/image's own aspect ratio — no cropping, whatever the fit mode."
                className="flex items-center gap-1.5 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1 text-xs text-[var(--text-3)] hover:border-[var(--border-2)]"
              >
                <Maximize2 size={12} />
                Fit to content
              </button>
            )}
          </div>

          {source.fit === 'contain' && (
            <div className="flex items-center gap-2">
              {(['solid', 'blur'] as const).map((bg) => (
                <button
                  key={bg}
                  onClick={() => onChange({ ...source, bg })}
                  className={`rounded-md border px-3 py-1 text-xs capitalize ${
                    source.bg === bg
                      ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                      : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
                  }`}
                >
                  {bg} background
                </button>
              ))}
              {source.bg === 'solid' && (
                <input
                  type="color"
                  value={source.bgColor}
                  onChange={(e) => onChange({ ...source, bgColor: e.target.value })}
                  className="h-7 w-10 rounded border border-[var(--border-1)] bg-transparent"
                />
              )}
            </div>
          )}

          <VolumeSlider
            volume={source.volume}
            onChange={(volume) => onChange({ ...source, volume })}
          />

          {source.path && mediaKindFromPath(source.path) === 'video' && (
            <MediaTrimEditor
              key={source.path}
              path={source.path}
              loop={source.loop}
              trimStart={source.trimStart}
              trimEnd={source.trimEnd}
              onChange={(patch) => onChange({ ...source, ...patch })}
            />
          )}
        </div>
      )
    case 'youtube':
      return (
        <div className="flex flex-col gap-3">
          <UrlField
            placeholder="https://www.youtube.com/watch?v=…"
            value={source.url}
            onCommit={(url) => onChange({ type: 'youtube', url, volume: source.volume })}
          />
          <VolumeSlider
            volume={source.volume}
            onChange={(volume) => onChange({ ...source, volume })}
          />
        </div>
      )
    case 'web':
      return (
        <div className="flex flex-col gap-3">
          <UrlField
            placeholder="https://example.com/dashboard"
            value={source.url}
            onCommit={(url) => onChange({ ...source, url })}
          />
          <VolumeSlider
            volume={source.volume}
            onChange={(volume) => onChange({ ...source, volume })}
            binaryOnly
          />
        </div>
      )
    case 'stats':
      return (
        <StatsEditor
          widgets={source.widgets}
          style={source.style}
          onChange={(patch) => onChange({ ...source, ...patch })}
        />
      )
    case 'camera':
      return (
        <CameraEditor
          deviceId={source.deviceId}
          rtspUrl={source.rtspUrl}
          onChange={(patch) => onChange({ type: 'camera', ...patch })}
        />
      )
    case 'clock':
      return (
        <ClockEditor
          format={source.format}
          showDate={source.showDate}
          color={source.color}
          align={source.align}
          onChange={(patch) => onChange({ ...source, ...patch })}
        />
      )
    case 'calendar':
      return (
        <CalendarEditor
          accentColor={source.accentColor}
          mode={source.mode}
          icsUrl={source.icsUrl}
          onChange={(patch) => onChange({ ...source, ...patch })}
        />
      )
    case 'nowplaying':
      return (
        <NowPlayingEditor
          color={source.color}
          align={source.align}
          onChange={(patch) => onChange({ ...source, ...patch })}
        />
      )
    case 'text':
      return (
        <TextEditor
          content={source.content}
          color={source.color}
          align={source.align}
          scale={source.scale}
          bold={source.bold}
          onChange={(patch) => onChange({ ...source, ...patch })}
        />
      )
    case 'color':
      return (
        <ColorEditor
          mode={source.mode}
          colorA={source.colorA}
          colorB={source.colorB}
          angle={source.angle}
          onChange={(patch) => onChange({ ...source, ...patch })}
        />
      )
    case 'layers':
      return (
        <p className="text-xs text-[var(--text-5)]">
          Nested layers aren&apos;t editable from here yet.
        </p>
      )
    case 'blank':
      return null
  }
}
