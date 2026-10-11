import { useEffect, useState, type ReactElement } from 'react'
import type { WeatherReport } from '@shared/types'
import { describeWeatherCode } from '@shared/weather'

const POLL_MS = 10 * 60 * 1000

/** Same dual-window lookup as the calendar agenda: `window.display` in the display window, `window.control` in the control window's previews. */
function getWeatherApi(): {
  get: (
    location: string,
    units: 'metric' | 'imperial'
  ) => Promise<{ report: WeatherReport | null; error?: string }>
} | null {
  return window.display?.weather ?? window.control?.weather ?? null
}

function formatTemp(value: number | null): string {
  return value === null ? '–' : `${Math.round(value)}°`
}

function weekdayLabel(date: string, index: number): string {
  if (index === 0) return 'Today'
  // "YYYY-MM-DD" parsed as local midnight, not UTC, so the weekday matches the date string.
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short' })
}

/**
 * Current conditions and (optionally) a 5-day forecast for a place, from
 * Open-Meteo via the main process — no API key or account. The location
 * is a free-text place name the main process geocodes, or "lat,lon".
 */
export function WeatherZone({
  location,
  units,
  color,
  showForecast
}: {
  location: string
  units: 'metric' | 'imperial'
  color: string
  showForecast: boolean
}): ReactElement {
  // Keyed by the request it answers, so changing location/units shows "Loading…" until the new answer arrives instead of the previous place's weather.
  const requestKey = `${location}|${units}`
  const [result, setResult] = useState<{
    key: string
    report: WeatherReport | null
    error: string | null
  } | null>(null)

  useEffect(() => {
    const api = getWeatherApi()
    if (!location.trim() || !api) return
    let cancelled = false
    const load = (): void => {
      api.get(location, units).then((res) => {
        if (cancelled) return
        setResult({ key: `${location}|${units}`, report: res.report, error: res.error ?? null })
      })
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [location, units])

  const shell = (children: ReactElement): ReactElement => (
    <div
      style={{
        containerType: 'size',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(4px, 4cqh, 20px)',
        padding: 'clamp(6px, 4cqmin, 28px)',
        color,
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden'
      }}
    >
      {children}
    </div>
  )

  const message = (text: string): ReactElement =>
    shell(<div style={{ fontSize: 'clamp(9px, 6cqmin, 22px)', opacity: 0.6 }}>{text}</div>)

  if (!location.trim()) return message('No location set')
  const current = result?.key === requestKey ? result : null
  const loading = current === null
  const report = current?.report ?? null
  const error = current?.error ?? null
  if (!report) return message(loading ? 'Loading…' : (error ?? "Couldn't load weather"))

  const now = describeWeatherCode(report.current.weatherCode, report.current.isDay)
  const windUnit = report.units === 'imperial' ? 'mph' : 'km/h'

  return shell(
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 4cqmin, 24px)' }}>
        <span style={{ fontSize: 'clamp(20px, 26cqmin, 140px)', lineHeight: 1 }}>{now.icon}</span>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span
            style={{
              fontSize: 'clamp(20px, 24cqmin, 128px)',
              fontWeight: 700,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {formatTemp(report.current.temperature)}
          </span>
          <span style={{ fontSize: 'clamp(9px, 6cqmin, 28px)', opacity: 0.8 }}>
            {now.label}
            {report.current.windSpeed !== null &&
              ` · ${Math.round(report.current.windSpeed)} ${windUnit}`}
          </span>
        </div>
      </div>
      <div
        style={{
          fontSize: 'clamp(8px, 5cqmin, 22px)',
          opacity: 0.6,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%'
        }}
      >
        {report.location}
      </div>
      {showForecast && report.daily.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${report.daily.length}, 1fr)`,
            gap: 'clamp(2px, 2cqw, 16px)',
            width: '100%',
            marginTop: 'clamp(2px, 2cqh, 12px)'
          }}
        >
          {report.daily.map((day, i) => (
            <div
              key={day.date}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                fontSize: 'clamp(7px, 4.5cqmin, 20px)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              <span style={{ opacity: 0.65 }}>{weekdayLabel(day.date, i)}</span>
              <span style={{ fontSize: 'clamp(10px, 8cqmin, 36px)' }}>
                {describeWeatherCode(day.weatherCode).icon}
              </span>
              <span>
                {formatTemp(day.max)}
                <span style={{ opacity: 0.55 }}> {formatTemp(day.min)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
