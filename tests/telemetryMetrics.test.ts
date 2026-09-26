import { describe, expect, it } from 'vitest'
import { getMetricDef } from '../src/shared/telemetryMetrics'
import type { Telemetry } from '../src/shared/types'

const baseTelemetry: Telemetry = {
  timestamp: 0,
  cpuTemp: 45,
  cpuLoad: 12,
  cpuClockMHz: 3800,
  gpuTemp: 60,
  gpuLoad: 20,
  gpuClockMHz: 1800,
  vramUsedMB: 2048,
  vramTotalMB: 8192,
  ramUsedMB: 8192,
  ramTotalMB: 32768,
  source: 'mixed'
}

describe('getMetricDef', () => {
  it('returns the definition for a known key', () => {
    expect(getMetricDef('cpuTemp')?.label).toBe('CPU Temp')
  })

  it('returns undefined for an unknown key', () => {
    expect(getMetricDef('not-a-metric')).toBeUndefined()
  })

  it('reads direct fields for cpuTemp/gpuLoad/etc', () => {
    expect(getMetricDef('cpuTemp')?.getValue(baseTelemetry)).toBe(45)
    expect(getMetricDef('gpuLoad')?.getValue(baseTelemetry)).toBe(20)
  })

  it('computes vramUsedPct and ramUsedPct from the raw MB fields', () => {
    expect(getMetricDef('vramUsedPct')?.getValue(baseTelemetry)).toBe(25)
    expect(getMetricDef('ramUsedPct')?.getValue(baseTelemetry)).toBe(25)
  })

  it('returns null for a percent metric when the total is missing', () => {
    const noTotal = { ...baseTelemetry, vramTotalMB: null }
    expect(getMetricDef('vramUsedPct')?.getValue(noTotal)).toBeNull()
  })
})
