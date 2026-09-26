import type { Telemetry } from '@shared/types'
import { getNvidiaSmiStats } from './nvidia'
import { getLhmStats } from './lhm'
import { getSystemInfoStats } from './systeminfo'

export interface TelemetryOptions {
  source: 'auto' | 'lhm' | 'si'
  lhmUrl: string
  intervalMs: number
}

/**
 * Polls all available sources on every tick and merges them: GPU stats
 * always come from nvidia-smi (there's no meaningful "si" GPU fallback
 * worth the complexity here), RAM/CPU-load/CPU-clock always come from
 * systeminformation, and CPU *temperature* comes from LibreHardwareMonitor
 * when reachable — the one metric systeminformation can't get on Windows
 * without extra drivers. `source: 'si'` skips the LHM attempt entirely;
 * `'lhm'` and `'auto'` behave the same (LHM opportunistically, ignored if
 * unreachable), since there's nothing else to fall back to for CPU temp.
 */
async function collectTelemetry(options: TelemetryOptions): Promise<Telemetry> {
  const [nvidia, lhm, sysinfo] = await Promise.all([
    getNvidiaSmiStats(),
    options.source === 'si' ? Promise.resolve(null) : getLhmStats(options.lhmUrl),
    getSystemInfoStats()
  ])

  const sourcesUsed: string[] = []
  if (nvidia) sourcesUsed.push('nvidia-smi')
  if (lhm) sourcesUsed.push('lhm')
  sourcesUsed.push('systeminformation')

  return {
    timestamp: Date.now(),
    cpuTemp: lhm?.cpuTemp ?? null,
    cpuLoad: sysinfo.cpuLoad ?? null,
    cpuClockMHz: sysinfo.cpuClockMHz ?? null,
    gpuTemp: nvidia?.gpuTemp ?? null,
    gpuLoad: nvidia?.gpuLoad ?? null,
    gpuClockMHz: nvidia?.gpuClockMHz ?? null,
    vramUsedMB: nvidia?.vramUsedMB ?? null,
    vramTotalMB: nvidia?.vramTotalMB ?? null,
    ramUsedMB: sysinfo.ramUsedMB,
    ramTotalMB: sysinfo.ramTotalMB,
    source: sourcesUsed.length > 1 ? 'mixed' : (sourcesUsed[0] as Telemetry['source'])
  }
}

export class TelemetryService {
  private timer: NodeJS.Timeout | null = null
  private onTick: (telemetry: Telemetry) => void

  constructor(onTick: (telemetry: Telemetry) => void) {
    this.onTick = onTick
  }

  start(options: TelemetryOptions): void {
    this.stop()
    const poll = (): void => {
      collectTelemetry(options).then(this.onTick)
    }
    poll()
    this.timer = setInterval(poll, options.intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
