/** Maps a 0–100 percent onto a monitor's own [min, max] raw range (they are rarely 0–100). */
export function levelToRaw(percent: number, min: number, max: number): number {
  const p = Math.min(Math.max(percent, 0), 100) / 100
  return Math.round(min + p * (max - min))
}

/** Inverse of levelToRaw. A degenerate range (min === max) reads as 100. */
export function rawToPercent(raw: number, min: number, max: number): number {
  if (max <= min) return 100
  return Math.round(((Math.min(Math.max(raw, min), max) - min) / (max - min)) * 100)
}
