import { describe, expect, it } from 'vitest'
import {
  buildTriggerState,
  createTriggerRuntimeState,
  evaluateTrigger
} from '../src/shared/triggers'
import type { Telemetry, Trigger } from '../src/shared/types'

function telemetryAt(timestamp: number, overrides: Partial<Telemetry> = {}): Telemetry {
  return {
    timestamp,
    cpuTemp: null,
    cpuLoad: null,
    cpuClockMHz: null,
    gpuTemp: null,
    gpuLoad: null,
    gpuClockMHz: null,
    vramUsedMB: null,
    vramTotalMB: null,
    ramUsedMB: null,
    ramTotalMB: null,
    source: 'mixed',
    ...overrides
  }
}

const gpuHot: Trigger = {
  id: 't1',
  name: 'GPU hot',
  metric: 'gpuTemp',
  op: '>',
  value: 85,
  holdSec: 5,
  clearBelow: 80,
  effect: { type: 'glow', color: '#ff0000' }
}

describe('evaluateTrigger', () => {
  it('stays inactive while a breach has not been held for holdSec', () => {
    let runtime = createTriggerRuntimeState()
    runtime = evaluateTrigger(gpuHot, telemetryAt(0, { gpuTemp: 90 }), runtime)
    expect(runtime.active).toBe(false)
    runtime = evaluateTrigger(gpuHot, telemetryAt(3000, { gpuTemp: 90 }), runtime)
    expect(runtime.active).toBe(false)
  })

  it('activates once the breach is held for at least holdSec', () => {
    let runtime = createTriggerRuntimeState()
    runtime = evaluateTrigger(gpuHot, telemetryAt(0, { gpuTemp: 90 }), runtime)
    runtime = evaluateTrigger(gpuHot, telemetryAt(5000, { gpuTemp: 90 }), runtime)
    expect(runtime.active).toBe(true)
  })

  it('resets the hold timer if the value drops below the threshold before holdSec', () => {
    let runtime = createTriggerRuntimeState()
    runtime = evaluateTrigger(gpuHot, telemetryAt(0, { gpuTemp: 90 }), runtime)
    runtime = evaluateTrigger(gpuHot, telemetryAt(2000, { gpuTemp: 70 }), runtime)
    expect(runtime.active).toBe(false)
    expect(runtime.conditionSinceMs).toBeNull()
    runtime = evaluateTrigger(gpuHot, telemetryAt(3000, { gpuTemp: 90 }), runtime)
    runtime = evaluateTrigger(gpuHot, telemetryAt(7000, { gpuTemp: 90 }), runtime)
    expect(runtime.active).toBe(false)
  })

  it('applies hysteresis: stays active between clearBelow and value once triggered', () => {
    let runtime = createTriggerRuntimeState()
    runtime = evaluateTrigger(gpuHot, telemetryAt(0, { gpuTemp: 90 }), runtime)
    runtime = evaluateTrigger(gpuHot, telemetryAt(5000, { gpuTemp: 90 }), runtime)
    expect(runtime.active).toBe(true)

    runtime = evaluateTrigger(gpuHot, telemetryAt(6000, { gpuTemp: 82 }), runtime)
    expect(runtime.active).toBe(true)

    runtime = evaluateTrigger(gpuHot, telemetryAt(7000, { gpuTemp: 79 }), runtime)
    expect(runtime.active).toBe(false)
  })

  it('treats a missing metric value as inactive', () => {
    const runtime = evaluateTrigger(
      gpuHot,
      telemetryAt(0, { gpuTemp: null }),
      createTriggerRuntimeState()
    )
    expect(runtime.active).toBe(false)
  })

  it('computes vramUsedPct and ramUsedPct from raw MB fields', () => {
    const vramTrigger: Trigger = {
      ...gpuHot,
      id: 't2',
      metric: 'vramUsedPct',
      value: 90,
      clearBelow: 85
    }
    let runtime = createTriggerRuntimeState()
    runtime = evaluateTrigger(
      vramTrigger,
      telemetryAt(0, { vramUsedMB: 9500, vramTotalMB: 10000 }),
      runtime
    )
    runtime = evaluateTrigger(
      vramTrigger,
      telemetryAt(5000, { vramUsedMB: 9500, vramTotalMB: 10000 }),
      runtime
    )
    expect(runtime.active).toBe(true)
  })
})

describe('buildTriggerState', () => {
  it('lists only active triggers and their effects tagged with triggerId', () => {
    const t2: Trigger = { ...gpuHot, id: 't2', effect: { type: 'preset', presetId: 'alert' } }
    const state = buildTriggerState(
      [gpuHot, t2],
      new Map([
        ['t1', true],
        ['t2', false]
      ])
    )
    expect(state.activeTriggerIds).toEqual(['t1'])
    expect(state.effects).toEqual([{ type: 'glow', color: '#ff0000', triggerId: 't1' }])
  })
})
