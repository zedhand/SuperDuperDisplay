import { describe, expect, it } from 'vitest'
import { formatDuration, timerState } from '../src/shared/timerMath'
import { formatDataValue, getByPath, parseHeaderLines } from '../src/shared/dataPath'

describe('formatDuration', () => {
  it('formats hh:mm:ss', () => expect(formatDuration(3_723_000)).toBe('01:02:03'))
  it('adds days', () => expect(formatDuration(90_061_000)).toBe('1d 01:01:01'))
  it('can drop zero hours', () => expect(formatDuration(65_000, true)).toBe('01:05'))
  it('clamps negatives', () => expect(formatDuration(-5)).toBe('00:00:00'))
})

describe('timerState', () => {
  const now = new Date('2026-01-01T12:00:00').getTime()
  it('counts down and reports done', () => {
    expect(timerState('countdown', '2026-01-01T12:00:10', now, 0)).toEqual({
      ms: 10_000,
      done: false
    })
    expect(timerState('countdown', '2026-01-01T11:00:00', now, 0)).toEqual({ ms: 0, done: true })
  })
  it('counts up from a date', () => {
    expect(timerState('countup', '2026-01-01T11:59:00', now, 0)?.ms).toBe(60_000)
  })
  it('session counts from the session start', () => {
    expect(timerState('session', undefined, now, now - 5000)?.ms).toBe(5000)
  })
  it('is null without a valid target', () => {
    expect(timerState('countdown', undefined, now, 0)).toBeNull()
    expect(timerState('countdown', 'nope', now, 0)).toBeNull()
  })
})

describe('getByPath', () => {
  const json = { state: 'on', data: [{ viewer_count: 42 }], a: { b: 1 } }
  it('reads nested keys', () => expect(getByPath(json, 'a.b')).toBe(1))
  it('reads array indexes both ways', () => {
    expect(getByPath(json, 'data.0.viewer_count')).toBe(42)
    expect(getByPath(json, 'data[0].viewer_count')).toBe(42)
  })
  it('is undefined for misses', () => {
    expect(getByPath(json, 'x.y')).toBeUndefined()
    expect(getByPath(json, 'state.length.x')).toBeUndefined()
    expect(getByPath(null, 'a')).toBeUndefined()
  })
})

describe('formatDataValue', () => {
  it('rounds numbers', () => expect(formatDataValue(3.14159)).toBe('3.14'))
  it('passes strings and booleans', () => {
    expect(formatDataValue('on')).toBe('on')
    expect(formatDataValue(true)).toBe('true')
  })
  it('rejects objects and null', () => {
    expect(formatDataValue({})).toBeNull()
    expect(formatDataValue(null)).toBeNull()
  })
})

describe('parseHeaderLines', () => {
  it('parses name: value lines', () => {
    expect(parseHeaderLines('Authorization: Bearer abc\nClient-Id: x:y')).toEqual({
      Authorization: 'Bearer abc',
      'Client-Id': 'x:y'
    })
  })
  it('skips malformed lines and bad names', () => {
    expect(parseHeaderLines('nonsense\n: nothing\nBad Name: v')).toEqual({})
  })
})
