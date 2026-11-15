import { useEffect, useState, type ReactElement } from 'react'
import { Sparkles } from 'lucide-react'
import type { DisplayInfo, DisplayMode, Rotation } from '@shared/types'
import { useConfigStore } from '../store/useConfigStore'

const ROTATIONS: Rotation[] = [0, 90, 180, 270]
const MODES: DisplayMode[] = ['live', 'black', 'hidden']
const MODE_LABELS: Record<DisplayMode, string> = { live: 'Live', black: 'Black', hidden: 'Desktop' }
const MODE_DESCRIPTIONS: Record<DisplayMode, string> = {
  live: 'Shows the active scene’s content.',
  black: 'Shows a black screen, but SuperDuperDisplay is still running underneath.',
  hidden:
    'Bypasses SuperDuperDisplay entirely — the panel behaves like a normal extended desktop monitor, exactly as if the app weren’t running. Drag any window onto it, or place icons there.'
}

type DisplayRow = DisplayInfo & { isTarget: boolean }

export function DisplaysPage(): ReactElement {
  const config = useConfigStore((s) => s.config)
  const patch = useConfigStore((s) => s.patch)
  const [displays, setDisplays] = useState<DisplayRow[]>([])
  const [identifying, setIdentifying] = useState(false)
  const [ddcMessage, setDdcMessage] = useState<string | null>(null)

  useEffect(() => {
    window.control.displays.list().then(setDisplays)
    return window.control.displays.onChanged(setDisplays)
  }, [])

  if (!config) return <div className="p-6 text-[var(--text-4)]">Loading…</div>

  const { display } = config

  async function selectDisplay(d: DisplayRow): Promise<void> {
    await window.control.displays.setTarget({
      match: {
        label: d.label,
        width: d.bounds.width,
        height: d.bounds.height,
        x: d.bounds.x,
        y: d.bounds.y
      },
      rotation: display.rotation,
      simulate: false
    })
  }

  async function useSimulator(): Promise<void> {
    await window.control.displays.setTarget({
      match: display.match,
      rotation: display.rotation,
      simulate: true
    })
  }

  async function setRotation(rotation: Rotation): Promise<void> {
    await window.control.displays.setTarget({
      match: display.match,
      rotation,
      simulate: display.simulate
    })
  }

  /** Probes first so we can say why it won't work instead of silently doing nothing. */
  async function toggleHardwareBrightness(enabled: boolean): Promise<void> {
    if (!config) return
    if (enabled) {
      const probe = await window.control.brightness.probe()
      if (!probe.supported) {
        setDdcMessage(probe.error ?? 'This display doesn’t support brightness control.')
        return
      }
      setDdcMessage(`Supported — currently ${probe.percent}%.`)
    } else {
      setDdcMessage(null)
    }
    patch({
      display: {
        ...config.display,
        hardwareBrightness: { ...config.display.hardwareBrightness, enabled }
      }
    })
  }

  async function identify(): Promise<void> {
    setIdentifying(true)
    await window.control.displays.identify()
    setTimeout(() => setIdentifying(false), 900)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-1)]">Connected displays</h2>
        <div className="flex flex-col gap-2">
          {displays.map((d) => (
            <button
              key={d.id}
              onClick={() => selectDisplay(d)}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                d.isTarget && !display.simulate
                  ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]'
                  : 'border-[var(--border-1)] bg-[var(--surface-1)] hover:border-[var(--border-2)]'
              }`}
            >
              <div>
                <div className="text-sm font-medium text-[var(--text-1)]">{d.label}</div>
                <div className="text-xs text-[var(--text-4)]">
                  {d.bounds.width}×{d.bounds.height} at ({d.bounds.x}, {d.bounds.y}) · scale{' '}
                  {d.scaleFactor}x
                </div>
              </div>
              {d.isTarget && !display.simulate && (
                <span className="rounded-full bg-[var(--accent-bg-strong)] px-2 py-1 text-xs text-[var(--accent-light)]">
                  Target
                </span>
              )}
            </button>
          ))}

          <button
            onClick={useSimulator}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
              display.simulate
                ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]'
                : 'border-[var(--border-1)] bg-[var(--surface-1)] hover:border-[var(--border-2)]'
            }`}
          >
            <div>
              <div className="text-sm font-medium text-[var(--text-1)]">Simulated screen</div>
              <div className="text-xs text-[var(--text-4)]">
                A window on this monitor, sized like the case screen — use until the real panel is
                connected.
              </div>
            </div>
            {display.simulate && (
              <span className="rounded-full bg-[var(--accent-bg-strong)] px-2 py-1 text-xs text-[var(--accent-light)]">
                Target
              </span>
            )}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-1)]">Rotation</h2>
        <div className="flex gap-2">
          {ROTATIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRotation(r)}
              className={`rounded-md border px-4 py-2 text-sm ${
                display.rotation === r
                  ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                  : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
              }`}
            >
              {r}°
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-1)]">Mode</h2>
        <div className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => patch({ display: { ...display, mode: m } })}
              className={`rounded-md border px-4 py-2 text-sm ${
                display.mode === m
                  ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
                  : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--text-4)]">{MODE_DESCRIPTIONS[display.mode]}</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-1)]">Mouse</h2>
        <label className="flex w-fit cursor-pointer items-center gap-3 text-sm text-[var(--text-2)]">
          <input
            type="checkbox"
            checked={display.lockMouse}
            onChange={(e) => patch({ display: { ...display, lockMouse: e.target.checked } })}
          />
          Lock mouse out of the target display
        </label>
        <p className="mt-2 text-xs text-[var(--text-4)]">
          Stops the cursor from wandering onto the panel (handy in games). Windows only; has no
          effect on the simulated screen. Toggle it anywhere with Ctrl+Alt+M (with hotkeys enabled),
          the tray menu, or the phone remote; Settings → App rules turns it on automatically while a
          game runs.
        </p>
        <label className="mt-3 flex w-fit cursor-pointer items-center gap-3 text-sm text-[var(--text-2)]">
          <input
            type="checkbox"
            checked={display.keepWindowsOff}
            onChange={(e) => patch({ display: { ...display, keepWindowsOff: e.target.checked } })}
          />
          Keep other windows off the target display
        </label>
        <p className="mt-2 text-xs text-[var(--text-4)]">
          Moves any app window that lands on the panel back to your main monitor. Paused in Desktop
          mode, where the panel is meant to behave like a normal monitor.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-1)]">
          Brightness &amp; burn-in
        </h2>
        <label className="flex items-center gap-3 text-sm text-[var(--text-2)]">
          Dim
          <input
            type="range"
            min={0}
            max={85}
            value={display.dim.level}
            onChange={(e) =>
              patch({
                display: { ...display, dim: { ...display.dim, level: Number(e.target.value) } }
              })
            }
          />
          <span className="w-10 text-xs text-[var(--text-4)]">{display.dim.level}%</span>
        </label>
        <label className="mt-2 flex w-fit cursor-pointer items-center gap-3 text-sm text-[var(--text-2)]">
          <input
            type="checkbox"
            checked={display.dim.scheduled}
            onChange={(e) =>
              patch({
                display: { ...display, dim: { ...display.dim, scheduled: e.target.checked } }
              })
            }
          />
          Only between
          <input
            type="time"
            value={display.dim.from}
            onChange={(e) =>
              patch({ display: { ...display, dim: { ...display.dim, from: e.target.value } } })
            }
            className="rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-0.5 text-[var(--text-1)]"
          />
          and
          <input
            type="time"
            value={display.dim.to}
            onChange={(e) =>
              patch({ display: { ...display, dim: { ...display.dim, to: e.target.value } } })
            }
            className="rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-0.5 text-[var(--text-1)]"
          />
        </label>
        <p className="mt-2 text-xs text-[var(--text-4)]">
          A software dimmer over the picture (works on any panel). Handy at night, or to cut glare
          from a case window.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--text-2)]">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={display.hardwareBrightness.enabled}
              onChange={(e) => toggleHardwareBrightness(e.target.checked)}
            />
            Panel backlight (DDC/CI)
          </label>
          <input
            type="range"
            min={0}
            max={100}
            disabled={!display.hardwareBrightness.enabled}
            value={display.hardwareBrightness.level}
            onChange={(e) =>
              patch({
                display: {
                  ...display,
                  hardwareBrightness: {
                    ...display.hardwareBrightness,
                    level: Number(e.target.value)
                  }
                }
              })
            }
          />
          <span className="w-10 text-xs text-[var(--text-4)]">
            {display.hardwareBrightness.level}%
          </span>
        </div>
        {ddcMessage && <p className="mt-1 text-xs text-[var(--text-4)]">{ddcMessage}</p>}
        <p className="mt-2 text-xs text-[var(--text-4)]">
          Changes the monitor&apos;s real brightness, for panels that support it (many small case
          screens don&apos;t — you&apos;ll be told). The original level is put back when you turn
          this off or quit.
        </p>
        <label className="mt-3 flex w-fit cursor-pointer items-center gap-3 text-sm text-[var(--text-2)]">
          <input
            type="checkbox"
            checked={display.pixelShift}
            onChange={(e) => patch({ display: { ...display, pixelShift: e.target.checked } })}
          />
          Pixel shift (burn-in protection)
        </label>
        <p className="mt-2 text-xs text-[var(--text-4)]">
          Moves the picture by up to 2 px once a minute so static elements don&apos;t sit on the
          same pixels. Mainly useful for OLED panels.
        </p>
      </section>

      <section>
        <button
          onClick={identify}
          disabled={identifying}
          className="flex w-fit items-center gap-2 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-2 text-sm text-[var(--text-2)] hover:border-[var(--border-2)] disabled:opacity-50"
        >
          <Sparkles size={16} />
          {identifying ? 'Flashing…' : 'Identify screen'}
        </button>
      </section>
    </div>
  )
}
