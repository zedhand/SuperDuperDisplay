import type { Telemetry, Trigger, TriggerState } from './types'

/**
 * Per-trigger armed state, kept by the caller (main process) across ticks.
 * `sinceMs` is null when the condition isn't currently met; otherwise it's
 * the timestamp the condition started being true, used for `holdSec`.
 */
export interface TriggerRuntimeState {
  active: boolean
  conditionSinceMs: number | null
}

export function createTriggerRuntimeState(): TriggerRuntimeState {
  return { active: false, conditionSinceMs: null }
}

function metricValue(telemetry: Telemetry, metric: Trigger['metric']): number | null {
  switch (metric) {
    case 'cpuTemp':
      return telemetry.cpuTemp
    case 'gpuTemp':
      return telemetry.gpuTemp
    case 'cpuLoad':
      return telemetry.cpuLoad
    case 'gpuLoad':
      return telemetry.gpuLoad
    case 'vramUsedPct':
      return telemetry.vramUsedMB != null && telemetry.vramTotalMB
        ? (telemetry.vramUsedMB / telemetry.vramTotalMB) * 100
        : null
    case 'ramUsedPct':
      return telemetry.ramUsedMB != null && telemetry.ramTotalMB
        ? (telemetry.ramUsedMB / telemetry.ramTotalMB) * 100
        : null
  }
}

/**
 * Evaluates one trigger against a telemetry sample and mutates `runtime` in
 * place to track how long the condition has held. A trigger goes active only
 * after `holdSec` of continuous breach, and clears once the value crosses
 * `clearBelow` (hysteresis, so it doesn't flicker at the threshold edge).
 */
export function evaluateTrigger(
  trigger: Trigger,
  telemetry: Telemetry,
  runtime: TriggerRuntimeState
): TriggerRuntimeState {
  const value = metricValue(telemetry, trigger.metric)
  if (value == null) {
    return { active: false, conditionSinceMs: null }
  }

  const breached = trigger.op === '>' ? value > trigger.value : value < trigger.value
  const cleared = trigger.op === '>' ? value < trigger.clearBelow : value > trigger.clearBelow

  if (!runtime.active) {
    if (!breached) {
      return { active: false, conditionSinceMs: null }
    }
    const since = runtime.conditionSinceMs ?? telemetry.timestamp
    const heldMs = telemetry.timestamp - since
    const active = heldMs >= trigger.holdSec * 1000
    return { active, conditionSinceMs: since }
  }

  // currently active: stay active until the value clears past the hysteresis band
  if (cleared) {
    return { active: false, conditionSinceMs: null }
  }
  return { active: true, conditionSinceMs: runtime.conditionSinceMs }
}

export function buildTriggerState(
  triggers: Trigger[],
  activeById: Map<string, boolean>
): TriggerState {
  const activeTriggerIds = triggers.filter((t) => activeById.get(t.id)).map((t) => t.id)
  const effects = triggers
    .filter((t) => activeById.get(t.id))
    .map((t) => ({ ...t.effect, triggerId: t.id }))
  return { activeTriggerIds, effects }
}
