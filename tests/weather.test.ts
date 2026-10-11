import { describe, expect, it } from 'vitest'
import {
  describeWeatherCode,
  forecastUrl,
  parseForecast,
  parseGeocode,
  parseLatLon
} from '../src/shared/weather'

describe('parseLatLon', () => {
  it('parses "lat,lon" with optional spaces and signs', () => {
    expect(parseLatLon('51.5, -0.12')).toEqual({ latitude: 51.5, longitude: -0.12 })
    expect(parseLatLon('-33.87,151.21')).toEqual({ latitude: -33.87, longitude: 151.21 })
  })

  it('returns null for place names and out-of-range coordinates', () => {
    expect(parseLatLon('London')).toBeNull()
    expect(parseLatLon('91, 0')).toBeNull()
    expect(parseLatLon('0, 181')).toBeNull()
  })
})

describe('describeWeatherCode', () => {
  it('maps WMO codes to a label and icon', () => {
    expect(describeWeatherCode(0).label).toBe('Clear')
    expect(describeWeatherCode(63).label).toBe('Rain')
    expect(describeWeatherCode(95).label).toBe('Thunderstorm')
  })

  it('uses a night icon when it is dark', () => {
    expect(describeWeatherCode(0, false).icon).toBe('🌙')
    expect(describeWeatherCode(3, false).icon).toBe(describeWeatherCode(3, true).icon)
  })

  it('falls back for unknown codes', () => {
    expect(describeWeatherCode(-1).label).toBe('Unknown')
  })
})

describe('forecastUrl', () => {
  it('asks for fahrenheit and mph only in imperial units', () => {
    expect(forecastUrl(1, 2, 'imperial')).toContain('temperature_unit=fahrenheit')
    expect(forecastUrl(1, 2, 'metric')).not.toContain('temperature_unit')
  })
})

describe('parseGeocode', () => {
  it('builds a display name from the first result', () => {
    const place = parseGeocode({
      results: [{ name: 'Austin', latitude: 30.27, longitude: -97.74, admin1: 'Texas' }]
    })
    expect(place).toEqual({ name: 'Austin, Texas', latitude: 30.27, longitude: -97.74 })
  })

  it('returns null when nothing matched', () => {
    expect(parseGeocode({})).toBeNull()
    expect(parseGeocode(null)).toBeNull()
  })
})

describe('parseForecast', () => {
  const response = {
    current: { temperature_2m: 18.4, weather_code: 2, wind_speed_10m: 11.2, is_day: 0 },
    daily: {
      time: ['2026-10-11', '2026-10-12'],
      weather_code: [2, 61],
      temperature_2m_max: [20.1, 17.5],
      temperature_2m_min: [9.8, 8.2]
    }
  }

  it('flattens current conditions and daily forecast', () => {
    const report = parseForecast(response, 'Berlin', 'metric')
    expect(report.current).toEqual({
      temperature: 18.4,
      weatherCode: 2,
      windSpeed: 11.2,
      isDay: false
    })
    expect(report.daily).toEqual([
      { date: '2026-10-11', weatherCode: 2, max: 20.1, min: 9.8 },
      { date: '2026-10-12', weatherCode: 61, max: 17.5, min: 8.2 }
    ])
    expect(report.location).toBe('Berlin')
  })

  it('throws when current conditions are missing', () => {
    expect(() => parseForecast({ error: true }, 'X', 'metric')).toThrow()
  })
})
