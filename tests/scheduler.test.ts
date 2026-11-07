import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Scheduler } from '../src/main/scheduler'
import type { ScheduleEntry } from '@shared/types'

function entry(overrides: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    id: 'e1',
    name: 'test',
    presetId: 'preset-a',
    time: '18:30',
    days: [],
    enabled: true,
    ...overrides
  }
}

/** Runs one check at the given instant and returns the preset ids that fired. */
function fireAt(iso: string, entries: ScheduleEntry[], timeZone?: string): string[] {
  vi.setSystemTime(new Date(iso))
  const fired: string[] = []
  const s = new Scheduler(
    () => entries,
    () => timeZone,
    (id) => fired.push(id)
  )
  s.start() // start() runs an immediate check
  s.stop()
  return fired
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

// 2026-11-05T01:30:00Z is 18:30 Wed Nov 4 in UTC-7 (BC permanent time), 20:30 Wed in Toronto, 01:30 Thu in UTC.
const INSTANT = '2026-11-05T01:30:00Z'

describe('Scheduler time zone', () => {
  it('fires on wall-clock time in the configured zone, regardless of system zone', () => {
    expect(fireAt(INSTANT, [entry({ time: '18:30' })], 'America/Whitehorse')).toEqual(['preset-a'])
  })

  it('does not fire at the time that would be right in a different zone', () => {
    // 20:30 is what Toronto (EST, UTC-5) reads at this instant; Whitehorse must not match it
    expect(fireAt(INSTANT, [entry({ time: '20:30' })], 'America/Whitehorse')).toEqual([])
    expect(fireAt(INSTANT, [entry({ time: '20:30' })], 'America/Toronto')).toEqual(['preset-a'])
  })

  it('UTC zone reads UTC wall-clock', () => {
    expect(fireAt(INSTANT, [entry({ time: '01:30' })], 'UTC')).toEqual(['preset-a'])
  })

  it('weekday is evaluated in the configured zone, not the system zone', () => {
    // Wed (3) in Whitehorse, but Thu (4) in UTC
    expect(fireAt(INSTANT, [entry({ days: [3] })], 'America/Whitehorse')).toEqual(['preset-a'])
    expect(fireAt(INSTANT, [entry({ days: [4] })], 'America/Whitehorse')).toEqual([])
    expect(fireAt(INSTANT, [entry({ time: '01:30', days: [4] })], 'UTC')).toEqual(['preset-a'])
  })

  it('midnight reads as 00:00, not 24:00', () => {
    // 07:00Z is 00:00 Thu in UTC-7
    expect(
      fireAt('2026-11-05T07:00:00Z', [entry({ time: '00:00' })], 'America/Whitehorse')
    ).toEqual(['preset-a'])
  })

  it('an invalid zone falls back to the system zone instead of throwing', () => {
    expect(() => fireAt(INSTANT, [entry({})], 'Not/AZone')).not.toThrow()
  })
})

describe('Scheduler behaviour', () => {
  it('skips disabled entries', () => {
    expect(fireAt(INSTANT, [entry({ enabled: false })], 'America/Whitehorse')).toEqual([])
  })

  it('fires an entry at most once per minute', () => {
    vi.setSystemTime(new Date(INSTANT))
    const fired: string[] = []
    const s = new Scheduler(
      () => [entry({})],
      () => 'America/Whitehorse',
      (id) => fired.push(id)
    )
    s.start()
    vi.advanceTimersByTime(15_000) // two more interval checks inside the same minute
    vi.advanceTimersByTime(15_000)
    s.stop()
    expect(fired).toEqual(['preset-a'])
  })

  it('fires again the next day', () => {
    vi.setSystemTime(new Date(INSTANT))
    const fired: string[] = []
    const s = new Scheduler(
      () => [entry({})],
      () => 'America/Whitehorse',
      (id) => fired.push(id)
    )
    s.start()
    vi.setSystemTime(new Date('2026-11-06T01:30:00Z'))
    vi.advanceTimersByTime(15_000)
    s.stop()
    expect(fired).toEqual(['preset-a', 'preset-a'])
  })
})
