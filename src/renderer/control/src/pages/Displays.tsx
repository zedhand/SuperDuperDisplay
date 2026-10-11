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
