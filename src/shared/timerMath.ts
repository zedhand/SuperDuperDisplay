export type TimerMode = 'countdown' | 'countup' | 'session'

/** "1d 02:03:04" past a day, otherwise "02:03:04" (or "03:04" when hours are 0 and `compact`). */
export function formatDuration(ms: number, compact = false): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`
  if (compact && h === 0) return `${pad(m)}:${pad(s)}`
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/**
 * What a timer zone should show right now. `target` is a datetime-local
 * string ("2026-12-25T09:00") read in the viewer's local zone. A countdown
 * past its target reports `done` and holds at zero; an invalid/missing
 * target yields null so the zone can say "set a date" instead of NaN.
 */
export function timerState(
  mode: TimerMode,
  target: string | undefined,
  now: number,
  sessionStart: number
): { ms: number; done: boolean } | null {
  if (mode === 'session') return { ms: Math.max(0, now - sessionStart), done: false }
  const t = target ? new Date(target).getTime() : NaN
  if (Number.isNaN(t)) return null
  if (mode === 'countdown') {
    const ms = t - now
    return { ms: Math.max(0, ms), done: ms <= 0 }
  }
  return { ms: Math.max(0, now - t), done: false }
}
