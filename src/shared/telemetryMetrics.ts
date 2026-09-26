import type { Telemetry } from './types'

export interface MetricDef {
  key: string
  label: string
  unit: string
  /** Used only to scale a bar/gauge fill; not a hard limit on the value itself. */
  max: number
  getValue: (t: Telemetry) => number | null
}

export const METRICS: MetricDef[] = [
  { key: 'cpuTemp', label: 'CPU Temp', unit: '°C', max: 95, getValue: (t) => t.cpuTemp },
  { key: 'gpuTemp', label: 'GPU Temp', unit: '°C', max: 95, getValue: (t) => t.gpuTemp },
  { key: 'cpuLoad', label: 'CPU Load', unit: '%', max: 100, getValue: (t) => t.cpuLoad },
  { key: 'gpuLoad', label: 'GPU Load', unit: '%', max: 100, getValue: (t) => t.gpuLoad },
  {
    key: 'cpuClockMHz',
    label: 'CPU Clock',
    unit: 'MHz',
    max: 6000,
    getValue: (t) => t.cpuClockMHz
  },
  {
    key: 'gpuClockMHz',
    label: 'GPU Clock',
    unit: 'MHz',
    max: 3000,
    getValue: (t) => t.gpuClockMHz
  },
  {
    key: 'vramUsedPct',
    label: 'VRAM',
    unit: '%',
    max: 100,
    getValue: (t) =>
      t.vramUsedMB != null && t.vramTotalMB ? (t.vramUsedMB / t.vramTotalMB) * 100 : null
  },
  {
    key: 'ramUsedPct',
    label: 'RAM',
    unit: '%',
    max: 100,
    getValue: (t) =>
      t.ramUsedMB != null && t.ramTotalMB ? (t.ramUsedMB / t.ramTotalMB) * 100 : null
  }
]

const METRICS_BY_KEY = new Map(METRICS.map((m) => [m.key, m]))

export function getMetricDef(key: string): MetricDef | undefined {
  return METRICS_BY_KEY.get(key)
}
