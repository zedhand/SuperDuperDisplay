import { useEffect, useState, type ReactElement } from 'react'
import type { CalendarEvent } from '@shared/types'

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const AGENDA_POLL_MS = 5 * 60 * 1000

/** Re-checks once a minute — cheap, and means a scene left running overnight rolls to the next day/month on its own. */
function useToday(): Date {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setToday(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return today
}

function buildMonthGrid(year: number, month: number): Array<number | null> {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = Array(firstWeekday).fill(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function MonthGridView({ accentColor }: { accentColor: string }): ReactElement {
  const today = useToday()
  const year = today.getFullYear()
  const month = today.getMonth()
  const cells = buildMonthGrid(year, month)
  const monthLabel = today.toLocaleDateString([], { month: 'long', year: 'numeric' })

  return (
    <>
      <div
        style={{
          fontSize: 'clamp(10px, 8cqmin, 32px)',
          fontWeight: 600,
          marginBottom: 'clamp(4px, 3cqh, 16px)',
          whiteSpace: 'nowrap'
        }}
      >
        {monthLabel}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 'clamp(1px, 1cqmin, 6px)',
          width: '100%'
        }}
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            style={{
              textAlign: 'center',
              fontSize: 'clamp(7px, 5cqmin, 18px)',
              opacity: 0.6
            }}
          >
            {label}
          </div>
        ))}
        {cells.map((day, i) => {
          const isToday = day === today.getDate()
          return (
            <div
              key={i}
              style={{
                textAlign: 'center',
                fontSize: 'clamp(8px, 6cqmin, 22px)',
                aspectRatio: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: isToday ? accentColor : 'transparent',
                fontWeight: isToday ? 700 : 400
              }}
            >
              {day ?? ''}
            </div>
          )
        })}
      </div>
    </>
  )
}

/** Either global exists depending on which window this renders in — display window has `window.display`, control window (layers-canvas preview / live-preview pane) has `window.control`. Both expose the identical `calendar.getAgenda` shape. */
function getCalendarApi(): {
  getAgenda: (icsUrl: string) => Promise<{ events: CalendarEvent[]; error?: string }>
} | null {
  return window.display?.calendar ?? window.control?.calendar ?? null
}

function formatEventWhen(event: CalendarEvent): string {
  const start = new Date(event.start)
  if (event.allDay)
    return start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  return start.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function AgendaView({
  accentColor,
  icsUrl
}: {
  accentColor: string
  icsUrl?: string
}): ReactElement {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!icsUrl) return
    const api = getCalendarApi()
    if (!api) return
    let cancelled = false
    const load = (): void => {
      api.getAgenda(icsUrl).then((result) => {
        if (cancelled) return
        setEvents(result.events)
        setError(result.error ?? null)
      })
    }
    load()
    const id = setInterval(load, AGENDA_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [icsUrl])

  if (!icsUrl) {
    return (
      <div style={{ fontSize: 'clamp(9px, 5cqmin, 20px)', opacity: 0.6 }}>
        No calendar feed configured
      </div>
    )
  }
  if (events === null) {
    return <div style={{ fontSize: 'clamp(9px, 5cqmin, 20px)', opacity: 0.6 }}>Loading…</div>
  }
  if (events.length === 0) {
    return (
      <div style={{ fontSize: 'clamp(9px, 5cqmin, 20px)', opacity: 0.6 }}>
        {error ? `Couldn't load calendar feed` : 'No upcoming events'}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(3px, 2cqh, 12px)',
        width: '100%'
      }}
    >
      {events.map((event) => (
        <div
          key={event.id}
          style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(4px, 2cqw, 12px)' }}
        >
          <span
            style={{
              width: 'clamp(4px, 1.5cqmin, 8px)',
              height: 'clamp(4px, 1.5cqmin, 8px)',
              borderRadius: '50%',
              background: accentColor,
              flexShrink: 0
            }}
          />
          <span
            style={{
              fontSize: 'clamp(8px, 5cqmin, 20px)',
              opacity: 0.65,
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            {formatEventWhen(event)}
          </span>
          <span
            style={{
              fontSize: 'clamp(9px, 5.5cqmin, 22px)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {event.title}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * `mode: 'grid'` (default, unchanged from v1): a self-contained local
 * month-grid view driven purely by the system clock — no accounts, no
 * network. `mode: 'agenda'`: real upcoming events from a subscribed `.ics`
 * feed URL (a calendar provider's "secret address"/publish-as-ICS export,
 * or any public `.ics` link) — still no OAuth or stored account
 * credentials, just a URL the main process fetches and parses.
 */
export function CalendarZone({
  accentColor,
  mode,
  icsUrl
}: {
  accentColor: string
  mode: 'grid' | 'agenda'
  icsUrl?: string
}): ReactElement {
  return (
    <div
      style={{
        containerType: 'size',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: mode === 'agenda' ? 'flex-start' : 'center',
        justifyContent: mode === 'agenda' ? 'flex-start' : 'center',
        padding: 'clamp(6px, 4cqmin, 28px)',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden'
      }}
    >
      {mode === 'agenda' ? (
        <AgendaView accentColor={accentColor} icsUrl={icsUrl} />
      ) : (
        <MonthGridView accentColor={accentColor} />
      )}
    </div>
  )
}
