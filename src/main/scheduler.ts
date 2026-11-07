import type { ScheduleEntry } from '@shared/types'
import { validZone } from '@shared/timeZone'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // matches Date.getDay() / ScheduleEntry.days

/**
 * Checks configured schedule entries against the current time (in the configured schedule time zone, default system) on a
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
  private getTimeZone: () => string | undefined
  private onActivatePreset: (presetId: string) => void

  constructor(
    getSchedule: () => ScheduleEntry[],
    getTimeZone: () => string | undefined,
    onActivatePreset: (presetId: string) => void
  ) {
    this.getSchedule = getSchedule
    this.getTimeZone = getTimeZone
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
    // Read the wall-clock time in the configured zone (system zone when unset), not via getHours() etc.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: validZone(this.getTimeZone()),
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short'
    }).formatToParts(new Date())
    const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? ''
    const currentTime = `${get('hour')}:${get('minute')}`
    const dayOfWeek = WEEKDAYS.indexOf(get('weekday'))
    const minuteKey = `${get('year')}-${get('month')}-${get('day')} ${currentTime}`

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
