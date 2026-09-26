import si from 'systeminformation'
import type { PartialTelemetry } from './parsers'

/**
 * RAM usage and CPU load/clock via systeminformation — reliable cross-
 * platform basics that need no extra software. CPU *temperature* is
 * deliberately not read here: on Windows, systeminformation's CPU
 * temperature sensor is usually unavailable without kernel-level driver
 * access, which is exactly the gap LibreHardwareMonitor fills instead.
 */
export async function getSystemInfoStats(): Promise<
  PartialTelemetry & { ramUsedMB: number | null; ramTotalMB: number | null }
> {
  try {
    const [load, speed, mem] = await Promise.all([si.currentLoad(), si.cpuCurrentSpeed(), si.mem()])
    return {
      cpuLoad: Math.round(load.currentLoad * 10) / 10,
      cpuClockMHz: speed.avg ? Math.round(speed.avg * 1000) : null,
      ramUsedMB: Math.round(mem.active / (1024 * 1024)),
      ramTotalMB: Math.round(mem.total / (1024 * 1024))
    }
  } catch {
    return { ramUsedMB: null, ramTotalMB: null }
  }
}
