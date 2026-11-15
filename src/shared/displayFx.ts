import type { AppConfig } from './types'

type Dim = AppConfig['display']['dim']

const MAX_DIM = 0.85

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h > 23 || min > 59 ? null : h * 60 + min
}

/** True if `now` falls in [from, to), where the window may wrap past midnight (e.g. 22:00 → 07:00). */
export function inTimeWindow(from: string, to: string, now: Date): boolean {
  const a = toMinutes(from)
  const b = toMinutes(to)
  if (a == null || b == null || a === b) return false
  const t = now.getHours() * 60 + now.getMinutes()
  return a < b ? t >= a && t < b : t >= a || t < b
}

/** Opacity (0–0.85) of the black dimming overlay right now. `level` is a percent. */
export function dimOpacity(dim: Dim, now: Date): number {
  const level = Math.min(Math.max(dim.level, 0), 100) / 100
  if (level <= 0) return 0
  if (dim.scheduled && !inTimeWindow(dim.from, dim.to, now)) return 0
  return Math.min(level, MAX_DIM)
}

const ORBIT: Array<[number, number]> = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
  [-2, 2],
  [-2, 0],
  [-2, -2],
  [0, -2],
  [2, -2]
]

/** Slowly walking pixel offset (changes once a minute) so static UI never sits on the same pixels. */
export function pixelShiftOffset(now: Date): { x: number; y: number } {
  const [x, y] = ORBIT[Math.floor(now.getTime() / 60_000) % ORBIT.length]
  return { x, y }
}
