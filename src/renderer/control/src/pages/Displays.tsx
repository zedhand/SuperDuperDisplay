import { useEffect, useState, type ReactElement } from 'react'
import { Sparkles } from 'lucide-react'
import type { DisplayInfo, DisplayMode, Rotation } from '@shared/types'
import { useConfigStore } from '../store/useConfigStore'

const ROTATIONS: Rotation[] = [0, 90, 180, 270]
const MODES: DisplayMode[] = ['live', 'black', 'hidden']

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

  if (!config) return <div className="p-6 text-white/50">Loading…</div>

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
        <h2 className="mb-3 text-lg font-semibold text-white">Connected displays</h2>
        <div className="flex flex-col gap-2">
          {displays.map((d) => (
            <button
              key={d.id}
              onClick={() => selectDisplay(d)}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                d.isTarget && !display.simulate
                  ? 'border-fuchsia-400/60 bg-fuchsia-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div>
                <div className="text-sm font-medium text-white">{d.label}</div>
                <div className="text-xs text-white/50">
                  {d.bounds.width}×{d.bounds.height} at ({d.bounds.x}, {d.bounds.y}) · scale{' '}
                  {d.scaleFactor}x
                </div>
              </div>
              {d.isTarget && !display.simulate && (
                <span className="rounded-full bg-fuchsia-500/20 px-2 py-1 text-xs text-fuchsia-300">
                  Target
                </span>
              )}
            </button>
          ))}

          <button
            onClick={useSimulator}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
              display.simulate
                ? 'border-fuchsia-400/60 bg-fuchsia-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div>
              <div className="text-sm font-medium text-white">Simulated screen</div>
              <div className="text-xs text-white/50">
                A window on this monitor, sized like the case screen — use until the real panel is
                connected.
              </div>
            </div>
            {display.simulate && (
              <span className="rounded-full bg-fuchsia-500/20 px-2 py-1 text-xs text-fuchsia-300">
                Target
              </span>
            )}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Rotation</h2>
        <div className="flex gap-2">
          {ROTATIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRotation(r)}
              className={`rounded-md border px-4 py-2 text-sm ${
                display.rotation === r
                  ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-300'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
              }`}
            >
              {r}°
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Mode</h2>
        <div className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => patch({ display: { ...display, mode: m } })}
              className={`rounded-md border px-4 py-2 text-sm capitalize ${
                display.mode === m
                  ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-300'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      <section>
        <button
          onClick={identify}
          disabled={identifying}
          className="flex w-fit items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:border-white/20 disabled:opacity-50"
        >
          <Sparkles size={16} />
          {identifying ? 'Flashing…' : 'Identify screen'}
        </button>
      </section>
    </div>
  )
}
