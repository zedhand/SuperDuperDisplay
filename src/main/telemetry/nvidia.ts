import { execFile } from 'child_process'
import { promisify } from 'util'
import { parseNvidiaSmiCsv, type PartialTelemetry } from './parsers'

const execFileAsync = promisify(execFile)

const QUERY_FIELDS = 'temperature.gpu,utilization.gpu,clocks.gr,memory.used,memory.total'

/** Returns null (rather than throwing) when nvidia-smi isn't on PATH or there's no NVIDIA GPU — a normal, expected case, not an error worth logging on every poll. */
export async function getNvidiaSmiStats(): Promise<PartialTelemetry | null> {
  try {
    const { stdout } = await execFileAsync('nvidia-smi', [
      `--query-gpu=${QUERY_FIELDS}`,
      '--format=csv,noheader,nounits'
    ])
    const firstLine = stdout.split('\n')[0]?.trim()
    return firstLine ? parseNvidiaSmiCsv(firstLine) : null
  } catch {
    return null
  }
}
