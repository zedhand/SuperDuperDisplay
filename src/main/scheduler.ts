import type { ScheduleEntry } from '@shared/types'

/**
 * Checks configured schedule entries against the current local time on a
 * short interval, firing `onActivatePreset` at most once per entry per
 * *minute* (a `lastFiredKey` guard, keyed by entry id + the exact minute) —
 * the check interval and the minute boundary won't align perfectly, so
 * without this guard a 15s check interval could fire the same entry two or
 * three times within its matching minute. `days: []` means "every day".
 */
export class Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private lastFiredKey = new Map<string, string>()
  private getSchedule: () => ScheduleEntry[]
  private onActivatePreset: (presetId: string) => void

  constructor(getSchedule: () => ScheduleEntry[], onActivatePreset: (presetId: string) => void) {
    this.getSchedule = getSchedule
    this.onActivatePreset = onActivatePreset
  }

  start(): void {
    this.stop()
    this.timer = setInterval(() => this.check(), 15_000)
    this.check()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private check(): void {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const currentTime = `${hh}:${mm}`
    const dayOfWeek = now.getDay()
    const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${currentTime}`

    for (const entry of this.getSchedule()) {
      if (!entry.enabled) continue
      if (entry.time !== currentTime) continue
      if (entry.days.length > 0 && !entry.days.includes(dayOfWeek)) continue
      if (this.lastFiredKey.get(entry.id) === minuteKey) continue
      this.lastFiredKey.set(entry.id, minuteKey)
      this.onActivatePreset(entry.presetId)
    }
  }
}
