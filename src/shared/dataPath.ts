/** Reads `a.b.0.c` or `a.b[0].c` out of parsed JSON. Returns undefined for any missing step instead of throwing. */
export function getByPath(data: unknown, path: string): unknown {
  const steps = path
    .trim()
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((s) => s.length > 0)
  let cur: unknown = data
  for (const step of steps) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[step]
  }
  return cur
}

/** Display text for a looked-up value: numbers are rounded to 2 decimals, objects are rejected. */
export function formatDataValue(value: unknown): string | null {
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : null
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return null
}

/** Parses "Name: value" lines into a header object. Blank/malformed lines and header-injecting names are skipped. */
export function parseHeaderLines(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i <= 0) continue
    const name = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim()
    if (!/^[A-Za-z0-9-]+$/.test(name) || /[\r\n]/.test(value)) continue
    out[name] = value
  }
  return out
}
