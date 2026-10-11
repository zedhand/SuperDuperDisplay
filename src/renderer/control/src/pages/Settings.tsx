import { useState, type ReactElement, type ReactNode } from 'react'
import type { AppConfig, ScheduleEntry } from '@shared/types'
import { useConfigStore } from '../store/useConfigStore'

const TELEMETRY_SOURCES: Array<{ value: AppConfig['telemetry']['source']; label: string }> = [
  { value: 'auto', label: 'Auto (LibreHardwareMonitor, falls back to systeminformation)' },
  { value: 'lhm', label: 'LibreHardwareMonitor only' },
  { value: 'si', label: 'systeminformation only' }
]

const ACCENT_SWATCHES = [
  '#d946ef',
  '#a855f7',
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
  '#22c55e',
  '#f59e0b',
  '#ef4444'
]

const TRANSITION_PRESETS = [
  { label: 'Off (instant)', ms: 0 },
  { label: 'Fast', ms: 250 },
  { label: 'Medium', ms: 500 },
  { label: 'Slow', ms: 1000 }
]

function Toggle({
  checked,
  onChange,
  label,
  hint
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
}): ReactElement {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>
        <span className="block text-sm text-[var(--text-2)]">{label}</span>
        {hint && <span className="block text-xs text-[var(--text-5)]">{hint}</span>}
      </span>
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--text-1)]">{title}</h2>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  )
}

export function SettingsPage(): ReactElement {
  const config = useConfigStore((s) => s.config)
  const patch = useConfigStore((s) => s.patch)

  if (!config) return <div className="p-6 text-[var(--text-4)]">Loading…</div>

  return (
    <div className="flex flex-col gap-6 p-6">
      <Section title="Appearance">
        <div className="flex items-center gap-3 py-1.5">
          <span className="text-sm text-[var(--text-2)]">Theme</span>
          <div className="flex gap-1.5">
            {(['dark', 'light'] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => patch({ app: { ...config.app, theme } })}
                className={`rounded-md border px-3 py-1 text-xs capitalize ${
                  config.app.theme === theme
                    ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                    : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-[var(--text-5)]">
          Only affects this control app&apos;s own UI — the display window always renders exactly
          what a scene is configured to show.
        </p>
        <div className="flex items-center gap-3 py-1.5">
          <span className="text-sm text-[var(--text-2)]">Accent color</span>
          <input
            type="color"
            value={config.app.accentColor}
            onChange={(e) => patch({ app: { ...config.app, accentColor: e.target.value } })}
            className="h-7 w-10 rounded border border-[var(--border-1)] bg-transparent"
          />
          <div className="flex gap-1.5">
            {ACCENT_SWATCHES.map((color) => (
              <button
                key={color}
                onClick={() => patch({ app: { ...config.app, accentColor: color } })}
                style={{ background: color }}
                className={`h-6 w-6 rounded-full border-2 ${
                  config.app.accentColor.toLowerCase() === color
                    ? 'border-[var(--text-1)]'
                    : 'border-transparent'
                }`}
                title={color}
              />
            ))}
          </div>
        </div>
        <p className="text-xs text-[var(--text-5)]">
          Recolors this control app&apos;s own UI — separate from a scene&apos;s color profile,
          which affects the physical panel&apos;s output instead (see the Color page).
        </p>
      </Section>

      <Section title="App">
        <Toggle
          checked={config.app.launchAtLogin}
          onChange={(launchAtLogin) => patch({ app: { ...config.app, launchAtLogin } })}
          label="Launch at login"
          hint="Starts SuperDuperDisplay automatically when you sign in to Windows."
        />
        <Toggle
          checked={config.app.startMinimized}
          onChange={(startMinimized) => patch({ app: { ...config.app, startMinimized } })}
          label="Start minimized to tray"
          hint="Keeps the control window out of the way on launch; the display window still opens."
        />
      </Section>

      <Section title="Keyboard shortcuts">
        <Toggle
          checked={config.app.hotkeysEnabled}
          onChange={(hotkeysEnabled) => patch({ app: { ...config.app, hotkeysEnabled } })}
          label="Enable global hotkeys"
          hint="Work system-wide, even while another app is focused — off by default so nothing gets intercepted unexpectedly."
        />
        {config.app.hotkeysEnabled && (
          <p className="pl-7 text-xs text-[var(--text-5)]">
            Ctrl+Alt+1–9 activates the scene in that position · Ctrl+Alt+L live · Ctrl+Alt+B black ·
            Ctrl+Alt+D desktop
          </p>
        )}
      </Section>

      <Section title="Transitions">
        <div className="flex flex-wrap gap-2 py-1.5">
          {TRANSITION_PRESETS.map(({ label, ms }) => (
            <button
              key={label}
              onClick={() => patch({ display: { ...config.display, transitionMs: ms } })}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                config.display.transitionMs === ms
                  ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                  : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-5)]">
          Crossfades between scenes instead of an instant cut when switching. Off by default.
        </p>
      </Section>

      <ScheduleSection />

      <Section title="Telemetry">
        <label className="flex flex-col gap-1 py-1.5 text-sm text-[var(--text-2)]">
          Source
          <select
            value={config.telemetry.source}
            onChange={(e) =>
              patch({
                telemetry: {
                  ...config.telemetry,
                  source: e.target.value as AppConfig['telemetry']['source']
                }
              })
            }
            className="rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1.5 text-[var(--text-1)]"
          >
            {TELEMETRY_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {config.telemetry.source !== 'si' && (
          <label className="flex flex-col gap-1 py-1.5 text-sm text-[var(--text-2)]">
            LibreHardwareMonitor URL
            <input
              type="text"
              value={config.telemetry.lhmUrl}
              onChange={(e) =>
                patch({ telemetry: { ...config.telemetry, lhmUrl: e.target.value } })
              }
              className="rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1.5 text-[var(--text-1)]"
            />
            <span className="text-xs text-[var(--text-5)]">
              Requires LHM&apos;s Remote Web Server enabled (Options → Remote Web Server → Run).
            </span>
          </label>
        )}

        <label className="flex items-center gap-2 py-1.5 text-sm text-[var(--text-2)]">
          Poll every
          <input
            type="number"
            min={200}
            step={100}
            value={config.telemetry.intervalMs}
            onChange={(e) =>
              patch({
                telemetry: {
                  ...config.telemetry,
                  intervalMs: Math.max(200, Number(e.target.value) || 200)
                }
              })
            }
            className="w-24 rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-1)]"
          />
          ms
        </label>
      </Section>

      <Section title="Power">
        <Toggle
          checked={config.power.blankOnLock}
          onChange={(blankOnLock) => patch({ power: { ...config.power, blankOnLock } })}
          label="Blank display when Windows locks"
        />
        <Toggle
          checked={config.power.blankOnSuspend}
          onChange={(blankOnSuspend) => patch({ power: { ...config.power, blankOnSuspend } })}
          label="Blank display on sleep/suspend"
        />
        <label className="flex items-center gap-2 py-1.5 text-sm text-[var(--text-2)]">
          Blank after
          <input
            type="number"
            min={0}
            value={config.power.idleBlankMin}
            onChange={(e) =>
              patch({
                power: { ...config.power, idleBlankMin: Math.max(0, Number(e.target.value) || 0) }
              })
            }
            className="w-20 rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-1)]"
          />
          min idle (0 = disabled)
        </label>
      </Section>

      <BackupSection />
    </div>
  )
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function ScheduleSection(): ReactElement {
  const config = useConfigStore((s) => s.config)
  const patch = useConfigStore((s) => s.patch)
  if (!config) return <></>

  function updateSchedule(updater: (schedule: ScheduleEntry[]) => ScheduleEntry[]): void {
    if (!config) return
    patch({ schedule: updater(config.schedule) })
  }

  function addEntry(): void {
    if (!config) return
    const firstPresetId = config.presets[0]?.id ?? ''
    updateSchedule((schedule) => [
      ...schedule,
      {
        id: crypto.randomUUID(),
        name: 'New schedule',
        presetId: firstPresetId,
        time: '09:00',
        days: [],
        enabled: true
      }
    ])
  }

  function patchEntry(id: string, patchFields: Partial<ScheduleEntry>): void {
    updateSchedule((schedule) => schedule.map((e) => (e.id === id ? { ...e, ...patchFields } : e)))
  }

  function removeEntry(id: string): void {
    updateSchedule((schedule) => schedule.filter((e) => e.id !== id))
  }

  function toggleDay(entry: ScheduleEntry, day: number): void {
    const days = entry.days.includes(day)
      ? entry.days.filter((d) => d !== day)
      : [...entry.days, day].sort()
    patchEntry(entry.id, { days })
  }

  return (
    <Section title="Schedule">
      <div className="flex flex-col gap-3">
        {config.schedule.length === 0 && (
          <p className="text-xs text-[var(--text-5)]">
            No scheduled scene switches yet — e.g. &ldquo;Stats only&rdquo; every weekday morning.
          </p>
        )}
        {config.schedule.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-col gap-2 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={entry.enabled}
                onChange={(e) => patchEntry(entry.id, { enabled: e.target.checked })}
              />
              <input
                type="text"
                value={entry.name}
                onChange={(e) => patchEntry(entry.id, { name: e.target.value })}
                className="min-w-0 flex-1 rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-sm text-[var(--text-1)]"
              />
              <input
                type="time"
                value={entry.time}
                onChange={(e) => patchEntry(entry.id, { time: e.target.value })}
                className="rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-sm text-[var(--text-1)]"
              />
              <select
                value={entry.presetId}
                onChange={(e) => patchEntry(entry.id, { presetId: e.target.value })}
                className="rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-sm text-[var(--text-1)]"
              >
                {config.presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeEntry(entry.id)}
                className="rounded p-1.5 text-[var(--text-4)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
                title="Delete"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, day) => (
                <button
                  key={label}
                  onClick={() => toggleDay(entry, day)}
                  className={`rounded px-2 py-1 text-xs ${
                    entry.days.includes(day) || entry.days.length === 0
                      ? 'border border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                      : 'border border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-4)]'
                  }`}
                  title={
                    entry.days.length === 0 ? 'Every day (click to pick specific days)' : label
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={addEntry}
          className="w-fit rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:border-[var(--border-2)]"
        >
          + Add schedule entry
        </button>
      </div>
    </Section>
  )
}

function BackupSection(): ReactElement {
  const [status, setStatus] = useState<string | null>(null)

  async function handleExport(): Promise<void> {
    setStatus(null)
    const result = await window.control.config.export()
    if (result) setStatus(`Saved to ${result.filePath}`)
  }

  async function handleImport(): Promise<void> {
    setStatus(null)
    const result = await window.control.config.import()
    if (!result) return
    setStatus('error' in result ? result.error : 'Imported successfully.')
  }

  return (
    <Section title="Backup">
      <div className="flex flex-wrap items-center gap-2 py-1.5">
        <button
          onClick={handleExport}
          className="rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:border-[var(--border-2)]"
        >
          Export config…
        </button>
        <button
          onClick={handleImport}
          className="rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:border-[var(--border-2)]"
        >
          Import config…
        </button>
      </div>
      {status && <p className="text-xs text-[var(--text-4)]">{status}</p>}
      <p className="text-xs text-[var(--text-5)]">
        Exports every scene, layout, color profile, and trigger as one file — including your Remote
        page&apos;s access token, so treat an exported file like a password if you plan to share it.
        Importing replaces your entire current setup.
      </p>
    </Section>
  )
}
