/** Samples kept per metric. At the default 1 s telemetry interval this is the last minute. */
export const HISTORY_LENGTH = 60

/** Returns a new array with `value` appended and the oldest samples dropped past `limit`. null means "no reading". */
export function pushSample(
  history: Array<number | null>,
  value: number | null,
  limit = HISTORY_LENGTH
): Array<number | null> {
  const next = [...history, value]
  return next.length > limit ? next.slice(next.length - limit) : next
}

/**
 * SVG path data for a history line in a `width` x `height` box, scaled so
 * `max` is the top. Gaps (null readings) break the line instead of being
 * drawn as zero. Samples are right-aligned so a fresh graph fills in from
 * the right, like a task manager. Returns '' when nothing is drawable.
 */
export function sparklinePath(
  history: Array<number | null>,
  max: number,
  width: number,
  height: number,
  limit = HISTORY_LENGTH
): { line: string; area: string } {
  if (history.length === 0 || max <= 0) return { line: '', area: '' }
  const step = limit > 1 ? width / (limit - 1) : width
  const offset = limit - history.length
  const y = (v: number): number => height - Math.min(Math.max(v / max, 0), 1) * height

  let line = ''
  let area = ''
  let runStart: number | null = null
  let lastX = 0

  const closeRun = (): void => {
    if (runStart != null) {
      area += `L${lastX.toFixed(1)},${height} L${runStart.toFixed(1)},${height} Z `
      runStart = null
    }
  }

  history.forEach((v, i) => {
    if (v == null) {
      closeRun()
      return
    }
    const x = (offset + i) * step
    const py = y(v).toFixed(1)
    if (runStart == null) {
      line += `M${x.toFixed(1)},${py} `
      area += `M${x.toFixed(1)},${height} L${x.toFixed(1)},${py} `
      runStart = x
    } else {
      line += `L${x.toFixed(1)},${py} `
      area += `L${x.toFixed(1)},${py} `
    }
    lastX = x
  })
  closeRun()
  return { line: line.trim(), area: area.trim() }
}
