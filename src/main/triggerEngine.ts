import type { Telemetry, Trigger, TriggerState } from '@shared/types'
import {
  buildTriggerState,
  createTriggerRuntimeState,
  evaluateTrigger,
  type TriggerRuntimeState
} from '@shared/triggers'

/**
 * Evaluates every configured trigger against each telemetry tick, keeping
 * per-trigger hold/hysteresis state across ticks. A trigger whose effect is
 * `preset` fires `onActivatePreset` on the tick it *becomes* active (not
 * every tick it stays active, so it doesn't fight a manual preset change);
 * `glow` effects are purely descriptive and just flow into the broadcast
 * TriggerState for the renderer to draw.
 */
export class TriggerEngine {
  private runtime = new Map<string, TriggerRuntimeState>()
  private onState: (state: TriggerState) => void
  private onActivatePreset: (presetId: string) => void

  constructor(
    onState: (state: TriggerState) => void,
    onActivatePreset: (presetId: string) => void
  ) {
    this.onState = onState
    this.onActivatePreset = onActivatePreset
  }

  evaluate(triggers: Trigger[], telemetry: Telemetry): void {
    const activeById = new Map<string, boolean>()
    const validIds = new Set(triggers.map((t) => t.id))
    for (const key of this.runtime.keys()) {
      if (!validIds.has(key)) this.runtime.delete(key)
    }

    for (const trigger of triggers) {
      const prev = this.runtime.get(trigger.id) ?? createTriggerRuntimeState()
      const wasActive = prev.active
      const next = evaluateTrigger(trigger, telemetry, prev)
      this.runtime.set(trigger.id, next)
      activeById.set(trigger.id, next.active)

      if (next.active && !wasActive && trigger.effect.type === 'preset') {
        this.onActivatePreset(trigger.effect.presetId)
      }
    }

    this.onState(buildTriggerState(triggers, activeById))
  }
}
