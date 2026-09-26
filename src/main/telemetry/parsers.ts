import type { Telemetry } from '@shared/types'

export type PartialTelemetry = Partial<
  Pick<
    Telemetry,
    | 'gpuTemp'
    | 'gpuLoad'
    | 'gpuClockMHz'
    | 'vramUsedMB'
    | 'vramTotalMB'
    | 'cpuTemp'
    | 'cpuLoad'
    | 'cpuClockMHz'
  >
>

/**
 * Parses one CSV line from:
 *   nvidia-smi --query-gpu=temperature.gpu,utilization.gpu,clocks.gr,memory.used,memory.total --format=csv,noheader,nounits
 * e.g. "72, 45, 1500, 4096, 8192"
 */
export function parseNvidiaSmiCsv(line: string): PartialTelemetry | null {
  const parts = line.split(',').map((p) => Number(p.trim()))
  if (parts.length !== 5 || parts.some((n) => Number.isNaN(n))) return null
  const [gpuTemp, gpuLoad, gpuClockMHz, vramUsedMB, vramTotalMB] = parts
  return { gpuTemp, gpuLoad, gpuClockMHz, vramUsedMB, vramTotalMB }
}

/** LibreHardwareMonitor's web-server JSON tree shape: a recursive node with a label and either children or a sensor value. */
export interface LhmNode {
  Text: string
  Children?: LhmNode[]
  Value?: string
  SensorId?: string
}

interface LhmSensor {
  text: string
  sensorId: string
  value: number
}

function collectSensors(
  node: LhmNode,
  kind: 'temperature' | 'load' | 'clock',
  out: LhmSensor[]
): void {
  if (node.SensorId?.includes(`/${kind}/`) && node.Value) {
    const value = Number.parseFloat(node.Value)
    if (!Number.isNaN(value)) out.push({ text: node.Text, sensorId: node.SensorId, value })
  }
  for (const child of node.Children ?? []) collectSensors(child, kind, out)
}

/** Picks the sensor whose label matches one of `preferredLabels` (in priority order), or the first sensor found under a "cpu" SensorId path otherwise. */
function pickCpuSensor(sensors: LhmSensor[], preferredLabels: RegExp[]): number | null {
  const cpuSensors = sensors.filter((s) => /cpu/i.test(s.sensorId))
  for (const pattern of preferredLabels) {
    const match = cpuSensors.find((s) => pattern.test(s.text))
    if (match) return match.value
  }
  return cpuSensors[0]?.value ?? null
}

/**
 * Extracts CPU temperature/load/clock from a full LibreHardwareMonitor
 * data.json tree. LHM's exact node labels vary by CPU vendor (e.g. AMD's
 * "Core (Tctl/Tdie)" vs Intel's "CPU Package" for the headline temperature),
 * so this matches by priority-ordered label patterns first and falls back
 * to "first CPU sensor of that kind" when none of them are present.
 */
export function parseLhmData(root: LhmNode): PartialTelemetry {
  const temps: LhmSensor[] = []
  const loads: LhmSensor[] = []
  const clocks: LhmSensor[] = []
  collectSensors(root, 'temperature', temps)
  collectSensors(root, 'load', loads)
  collectSensors(root, 'clock', clocks)

  return {
    cpuTemp: pickCpuSensor(temps, [/Tctl/i, /CPU Package/i, /Package/i, /Tdie/i]),
    cpuLoad: pickCpuSensor(loads, [/CPU Total/i]),
    cpuClockMHz: pickCpuSensor(clocks, [/Core Average/i, /Core #1$/i])
  }
}
