import { parseLhmData, type LhmNode, type PartialTelemetry } from './parsers'

/**
 * LibreHardwareMonitor must be running with its Remote Web Server enabled
 * (Options > Remote Web Server > Run, admin rights required to read most
 * sensors) for this to return anything. Returns null on any failure — LHM
 * not running is the expected common case, not worth logging every poll.
 */
export async function getLhmStats(url: string): Promise<PartialTelemetry | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1500)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) return null
    const data = (await response.json()) as LhmNode
    return parseLhmData(data)
  } catch {
    return null
  }
}
