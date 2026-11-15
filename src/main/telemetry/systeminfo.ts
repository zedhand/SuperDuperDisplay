import si from 'systeminformation'
import type { PartialTelemetry } from './parsers'

export interface SystemInfoStats {
  cpuLoad?: number
  cpuClockMHz?: number | null
  ramUsedMB: number | null
  ramTotalMB: number | null
  netDownMbps?: number | null
  netUpMbps?: number | null
  diskUsedPct?: number | null
}

/** Bytes/sec summed over interfaces → megabits/sec, one decimal. Interfaces with no sample yet report null/-1 and are skipped. */
export function sumMbps(bytesPerSec: Array<number | null | undefined>): number | null {
  const valid = bytesPerSec.filter((n): n is number => typeof n === 'number' && n >= 0)
  if (valid.length === 0) return null
  const total = valid.reduce((a, b) => a + b, 0)
  return Math.round(((total * 8) / 1_000_000) * 10) / 10
}

/** Percent used of the system drive (falls back to the first drive). */
export function pickSystemDiskPct(
  disks: Array<{ mount: string; use: number }>,
  systemDrive = process.env['SystemDrive'] ?? 'C:'
): number | null {
  if (disks.length === 0) return null
  const sys = disks.find((d) => d.mount.toLowerCase().startsWith(systemDrive.toLowerCase()))
  return Math.round((sys ?? disks[0]).use * 10) / 10
}

/**
 * RAM usage, CPU load/clock, network throughput and system-disk usage via
 * systeminformation — reliable cross-platform basics that need no extra
 * software. CPU *temperature* is deliberately not read here: on Windows,
 * systeminformation's CPU temperature sensor is usually unavailable without
 * kernel-level driver access, which is exactly the gap LibreHardwareMonitor
 * fills instead.
 */
export async function getSystemInfoStats(): Promise<PartialTelemetry & SystemInfoStats> {
  const [load, speed, mem, net, disks] = await Promise.all([
    si.currentLoad().catch(() => null),
    si.cpuCurrentSpeed().catch(() => null),
    si.mem().catch(() => null),
    si.networkStats('*').catch(() => []),
    si.fsSize().catch(() => [])
  ])
  return {
    cpuLoad: load ? Math.round(load.currentLoad * 10) / 10 : undefined,
    cpuClockMHz: speed?.avg ? Math.round(speed.avg * 1000) : null,
    ramUsedMB: mem ? Math.round(mem.active / (1024 * 1024)) : null,
    ramTotalMB: mem ? Math.round(mem.total / (1024 * 1024)) : null,
    netDownMbps: sumMbps(net.map((n) => n.rx_sec)),
    netUpMbps: sumMbps(net.map((n) => n.tx_sec)),
    diskUsedPct: pickSystemDiskPct(disks)
  }
}
