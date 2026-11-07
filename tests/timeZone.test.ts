import { describe, expect, it } from 'vitest'
import { TIME_ZONE_OPTIONS, validZone } from '@shared/timeZone'

describe('validZone', () => {
  it('passes through valid IANA zones', () => {
    expect(validZone('America/Whitehorse')).toBe('America/Whitehorse')
    expect(validZone('UTC')).toBe('UTC')
  })

  it('returns undefined (system zone) for empty or unset', () => {
    expect(validZone(undefined)).toBeUndefined()
    expect(validZone('')).toBeUndefined()
  })

  it('returns undefined instead of throwing for garbage', () => {
    expect(validZone('Not/AZone')).toBeUndefined()
    expect(validZone('hello')).toBeUndefined()
  })

  it('every dropdown option is either the system default or a valid zone', () => {
    for (const o of TIME_ZONE_OPTIONS) {
      if (o.value === '') continue
      expect(validZone(o.value), o.value).toBe(o.value)
    }
  })

  it('America/Whitehorse is UTC-7 all year (the BC fix relies on this)', () => {
    const offsetHours = (iso: string): number => {
      const d = new Date(iso)
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Whitehorse',
        hour: 'numeric',
        hourCycle: 'h23'
      }).formatToParts(d)
      const hour = Number(parts.find((p) => p.type === 'hour')?.value)
      return hour - d.getUTCHours() + (hour > d.getUTCHours() ? -24 : 0)
    }
    expect(offsetHours('2026-01-15T12:00:00Z')).toBe(-7)
    expect(offsetHours('2026-07-15T12:00:00Z')).toBe(-7)
  })
})
