import type { WeatherReport } from './types'

export type WeatherUnits = 'metric' | 'imperial'

/**
 * WMO weather interpretation codes, as Open-Meteo reports them in
 * `weather_code`. Grouped the way Open-Meteo's own docs group them — the
 * display only needs a short label and a glyph, not every intensity
 * variant spelled out separately.
 */
const WEATHER_CODES: Array<{ codes: number[]; label: string; icon: string; nightIcon?: string }> = [
  { codes: [0], label: 'Clear', icon: '☀️', nightIcon: '🌙' },
  { codes: [1], label: 'Mostly clear', icon: '🌤️', nightIcon: '🌙' },
  { codes: [2], label: 'Partly cloudy', icon: '⛅', nightIcon: '☁️' },
  { codes: [3], label: 'Overcast', icon: '☁️' },
  { codes: [45, 48], label: 'Fog', icon: '🌫️' },
  { codes: [51, 53, 55, 56, 57], label: 'Drizzle', icon: '🌦️' },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], label: 'Rain', icon: '🌧️' },
  { codes: [71, 73, 75, 77, 85, 86], label: 'Snow', icon: '🌨️' },
  { codes: [95, 96, 99], label: 'Thunderstorm', icon: '⛈️' }
]

export function describeWeatherCode(code: number, isDay = true): { label: string; icon: string } {
  const entry = WEATHER_CODES.find((e) => e.codes.includes(code))
  if (!entry) return { label: 'Unknown', icon: '🌡️' }
  return { label: entry.label, icon: !isDay && entry.nightIcon ? entry.nightIcon : entry.icon }
}

/** Accepts "lat,lon" (e.g. "51.5, -0.12") so a location can skip geocoding entirely. */
export function parseLatLon(input: string): { latitude: number; longitude: number } | null {
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  const latitude = Number(match[1])
  const longitude = Number(match[2])
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}

export function forecastUrl(latitude: number, longitude: number, units: WeatherUnits): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code,wind_speed_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '5'
  })
  if (units === 'imperial') {
    params.set('temperature_unit', 'fahrenheit')
    params.set('wind_speed_unit', 'mph')
  }
  return `https://api.open-meteo.com/v1/forecast?${params}`
}

export function geocodeUrl(name: string): string {
  const params = new URLSearchParams({ name: name.trim(), count: '1', format: 'json' })
  return `https://geocoding-api.open-meteo.com/v1/search?${params}`
}

interface GeocodeResponse {
  results?: Array<{
    name: string
    latitude: number
    longitude: number
    admin1?: string
    country?: string
  }>
}

export function parseGeocode(
  data: unknown
): { name: string; latitude: number; longitude: number } | null {
  const first = (data as GeocodeResponse | null)?.results?.[0]
  if (!first || typeof first.latitude !== 'number' || typeof first.longitude !== 'number') {
    return null
  }
  const name = [first.name, first.admin1 ?? first.country].filter(Boolean).join(', ')
  return { name, latitude: first.latitude, longitude: first.longitude }
}

interface ForecastResponse {
  current?: {
    temperature_2m?: number
    weather_code?: number
    wind_speed_10m?: number
    is_day?: number
  }
  daily?: {
    time?: string[]
    weather_code?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
  }
}

/** Turns an Open-Meteo `/v1/forecast` response into the flat shape the Weather zone renders. Throws if the response has no current conditions. */
export function parseForecast(
  data: unknown,
  locationName: string,
  units: WeatherUnits
): WeatherReport {
  const { current, daily } = (data ?? {}) as ForecastResponse
  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('Weather response had no current conditions')
  }

  const days = daily?.time ?? []
  return {
    location: locationName,
    units,
    current: {
      temperature: current.temperature_2m,
      weatherCode: current.weather_code ?? -1,
      windSpeed: current.wind_speed_10m ?? null,
      isDay: current.is_day !== 0
    },
    daily: days.map((date, i) => ({
      date,
      weatherCode: daily?.weather_code?.[i] ?? -1,
      max: daily?.temperature_2m_max?.[i] ?? null,
      min: daily?.temperature_2m_min?.[i] ?? null
    }))
  }
}
