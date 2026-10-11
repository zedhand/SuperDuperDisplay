import { useEffect, useState, type ReactElement } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Telemetry, Trigger } from '@shared/types'
import { getMetricDef, METRICS } from '@shared/telemetryMetrics'
import { useConfigStore } from '../store/useConfigStore'

function newTrigger(): Trigger {
  return {
    id: crypto.randomUUID(),
    name: 'New trigger',
    metric: 'gpuTemp',
    op: '>',
    value: 85,
    holdSec: 5,
    clearBelow: 80,
    effect: { type: 'glow', color: '#ff2020' }
  }
}

export function TriggersPage(): ReactElement {
  const config = useConfigStore((s) => s.config)
  const patch = useConfigStore((s) => s.patch)
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)

  useEffect(() => window.control.telemetry.onTick(setTelemetry), [])

  if (!config) return <div className="p-6 text-[var(--text-4)]">Loading…</div>

  function updateTrigger(id: string, updater: (t: Trigger) => Trigger): void {
    if (!config) return
    patch({ triggers: config.triggers.map((t) => (t.id === id ? updater(t) : t)) })
  }

  function removeTrigger(id: string): void {
    if (!config) return
    patch({ triggers: config.triggers.filter((t) => t.id !== id) })
  }

  function addTrigger(): void {
    if (!config) return
    patch({ triggers: [...config.triggers, newTrigger()] })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-1)]">Triggers</h2>
          <button
            onClick={addTrigger}
            className="flex items-center gap-2 rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:border-[var(--border-2)]"
          >
            <Plus size={14} />
            Add trigger
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {config.triggers.length === 0 && (
            <p className="text-sm text-[var(--text-5)]">
              No triggers yet. Add one to react to temperature or load thresholds.
            </p>
          )}

          {config.triggers.map((trigger) => {
            const metricDef = getMetricDef(trigger.metric)
            const currentValue = telemetry && metricDef ? metricDef.getValue(telemetry) : null

            return (
              <div
                key={trigger.id}
                className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <input
                    value={trigger.name}
                    onChange={(e) =>
                      updateTrigger(trigger.id, (t) => ({ ...t, name: e.target.value }))
                    }
                    className="rounded border border-[var(--border-1)] bg-transparent px-2 py-1 text-sm font-medium text-[var(--text-1)]"
                  />
                  <button
                    onClick={() => removeTrigger(trigger.id)}
                    className="rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] p-1.5 text-[var(--text-4)] hover:border-red-400/40 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <select
                    value={trigger.metric}
                    onChange={(e) =>
                      updateTrigger(trigger.id, (t) => ({
                        ...t,
                        metric: e.target.value as Trigger['metric']
                      }))
                    }
                    className="rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-1)]"
                  >
                    {METRICS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={trigger.op}
                    onChange={(e) =>
                      updateTrigger(trigger.id, (t) => ({
                        ...t,
                        op: e.target.value as Trigger['op']
                      }))
                    }
                    className="rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-1)]"
                  >
                    <option value=">">greater than</option>
                    <option value="<">less than</option>
                  </select>

                  <input
                    type="number"
                    value={trigger.value}
                    onChange={(e) =>
                      updateTrigger(trigger.id, (t) => ({ ...t, value: Number(e.target.value) }))
                    }
                    className="w-20 rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-1)]"
                  />

                  {metricDef && <span className="text-[var(--text-5)]">{metricDef.unit}</span>}

                  {currentValue != null && (
                    <span className="text-xs text-[var(--text-5)]">
                      (now {Math.round(currentValue)})
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--text-3)]">
                  <label className="flex items-center gap-2">
                    hold
                    <input
                      type="number"
                      min={0}
                      value={trigger.holdSec}
                      onChange={(e) =>
                        updateTrigger(trigger.id, (t) => ({
                          ...t,
                          holdSec: Number(e.target.value)
                        }))
                      }
                      className="w-16 rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-1)]"
                    />
                    sec
                  </label>
                  <label className="flex items-center gap-2">
                    clear below
                    <input
                      type="number"
                      value={trigger.clearBelow}
                      onChange={(e) =>
                        updateTrigger(trigger.id, (t) => ({
                          ...t,
                          clearBelow: Number(e.target.value)
                        }))
                      }
                      className="w-20 rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-1)]"
                    />
                  </label>
                </div>

                <div className="mt-3 flex items-center gap-3 text-sm">
                  <select
                    value={trigger.effect.type}
                    onChange={(e) =>
                      updateTrigger(trigger.id, (t) => ({
                        ...t,
                        effect:
                          e.target.value === 'glow'
                            ? { type: 'glow', color: '#ff2020' }
                            : e.target.value === 'flash'
                              ? { type: 'flash', color: '#ff2020' }
                              : { type: 'preset', presetId: config?.presets[0]?.id ?? '' }
                      }))
                    }
                    className="rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-1)]"
                  >
                    <option value="glow">Pulsing glow</option>
                    <option value="flash">One-shot flash</option>
                    <option value="preset">Switch scene</option>
                  </select>

                  {trigger.effect.type === 'glow' || trigger.effect.type === 'flash' ? (
                    <input
                      type="color"
                      value={trigger.effect.color}
                      onChange={(e) =>
                        updateTrigger(trigger.id, (t) => ({
                          ...t,
                          effect: {
                            type: t.effect.type === 'flash' ? 'flash' : 'glow',
                            color: e.target.value
                          }
                        }))
                      }
                      className="h-7 w-10 rounded border border-[var(--border-1)] bg-transparent"
                    />
                  ) : (
                    <select
                      value={trigger.effect.presetId}
                      onChange={(e) =>
                        updateTrigger(trigger.id, (t) => ({
                          ...t,
                          effect: { type: 'preset', presetId: e.target.value }
                        }))
                      }
                      className="rounded border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-1)]"
                    >
                      {config.presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
