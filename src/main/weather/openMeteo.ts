import type { WeatherReport } from '@shared/types'
import {
  forecastUrl,
  geocodeUrl,
  parseForecast,
  parseGeocode,
  parseLatLon,
  type WeatherUnits
} from '@shared/weather'
import { fetchWithTimeout } from '../fetchWithTimeout'

const CACHE_TTL_MS = 10 * 60 * 1000 // Open-Meteo's models update hourly at most
const FETCH_TIMEOUT_MS = 10_000

const cache = new Map<string, { fetchedAt: number; report: WeatherReport }>()
const geocodeCache = new Map<string, { name: string; latitude: number; longitude: number }>()

async function resolveLocation(
  location: string
): Promise<{ name: string; latitude: number; longitude: number }> {
  const coords = parseLatLon(location)
  if (coords) return { name: location.trim(), ...coords }

  const key = location.trim().toLowerCase()
  const cached = geocodeCache.get(key)
  if (cached) return cached

  const response = await fetchWithTimeout(geocodeUrl(location), FETCH_TIMEOUT_MS)
  const place = parseGeocode(await response.json())
  if (!place) throw new Error(`Couldn't find a place called "${location.trim()}"`)
  geocodeCache.set(key, place)
  return place
}

/**
 * Current conditions + a 5-day forecast from Open-Meteo — free, no API key,
 * no account, so the Weather zone needs nothing more than a place name.
 * Same caching shape as the calendar agenda: cached per location+units for
 * `CACHE_TTL_MS`, and on failure falls back to the last good report (even
 * if stale) instead of blanking a zone that was showing real data.
 */
export async function getWeather(
  location: string,
  units: WeatherUnits
): Promise<{ report: WeatherReport | null; error?: string }> {
  if (!location.trim()) return { report: null, error: 'No location set' }

  const key = `${location.trim().toLowerCase()}|${units}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { report: cached.report }
  }

  try {
    const place = await resolveLocation(location)
    const response = await fetchWithTimeout(
      forecastUrl(place.latitude, place.longitude, units),
      FETCH_TIMEOUT_MS
    )
    const report = parseForecast(await response.json(), place.name, units)
    cache.set(key, { fetchedAt: Date.now(), report })
    return { report }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { report: cached?.report ?? null, error: message }
  }
}
