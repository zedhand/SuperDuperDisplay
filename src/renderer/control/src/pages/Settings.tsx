import type { ReactElement, ReactNode } from 'react'
import type { AppConfig } from '@shared/types'
import { useConfigStore } from '../store/useConfigStore'

const TELEMETRY_SOURCES: Array<{ value: AppConfig['telemetry']['source']; label: string }> = [
  { value: 'auto', label: 'Auto (LibreHardwareMonitor, falls back to systeminformation)' },
  { value: 'lhm', label: 'LibreHardwareMonitor only' },
  { value: 'si', label: 'systeminformation only' }
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
        <span className="block text-sm text-white/80">{label}</span>
        {hint && <span className="block text-xs text-white/40">{hint}</span>}
      </span>
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="rounded-lg border border-white/10 bg-white/5 p-4">
      <h2 className="mb-3 text-sm font-semibold text-white">{title}</h2>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  )
}

export function SettingsPage(): ReactElement {
  const config = useConfigStore((s) => s.config)
  const patch = useConfigStore((s) => s.patch)

  if (!config) return <div className="p-6 text-white/50">Loading…</div>

  return (
    <div className="flex flex-col gap-6 p-6">
      <Section title="App">
        <Toggle
          checked={config.app.launchAtLogin}
          onChange={(launchAtLogin) => patch({ app: { ...config.app, launchAtLogin } })}
          label="Launch at login"
          hint="Starts MiniDisplay automatically when you sign in to Windows."
        />
        <Toggle
          checked={config.app.startMinimized}
          onChange={(startMinimized) => patch({ app: { ...config.app, startMinimized } })}
          label="Start minimized to tray"
          hint="Keeps the control window out of the way on launch; the display window still opens."
        />
      </Section>

      <Section title="Telemetry">
        <label className="flex flex-col gap-1 py-1.5 text-sm text-white/80">
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
            className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-white"
          >
            {TELEMETRY_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {config.telemetry.source !== 'si' && (
          <label className="flex flex-col gap-1 py-1.5 text-sm text-white/80">
            LibreHardwareMonitor URL
            <input
              type="text"
              value={config.telemetry.lhmUrl}
              onChange={(e) =>
                patch({ telemetry: { ...config.telemetry, lhmUrl: e.target.value } })
              }
              className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-white"
            />
            <span className="text-xs text-white/40">
              Requires LHM&apos;s Remote Web Server enabled (Options → Remote Web Server → Run).
            </span>
          </label>
        )}

        <label className="flex items-center gap-2 py-1.5 text-sm text-white/80">
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
            className="w-24 rounded border border-white/10 bg-white/5 px-2 py-1 text-white"
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
        <label className="flex items-center gap-2 py-1.5 text-sm text-white/80">
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
            className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-white"
          />
          min idle (0 = disabled)
        </label>
      </Section>
    </div>
  )
}
