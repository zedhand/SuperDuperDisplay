import ical from 'node-ical'
import type { CalendarEvent } from '@shared/types'

const CACHE_TTL_MS = 5 * 60 * 1000
const HORIZON_MS = 14 * 24 * 60 * 60 * 1000 // upcoming 2 weeks
const MAX_EVENTS = 10
const FETCH_TIMEOUT_MS = 10_000

const cache = new Map<string, { fetchedAt: number; events: CalendarEvent[] }>()

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out fetching calendar feed')), ms)
    )
  ])
}

/**
 * Fetches and parses a subscribed `.ics` feed URL (a calendar provider's
 * "secret address"/publish-as-ICS export — Google, Outlook, Apple Calendar
 * all offer one — or any public `.ics` link) into a flat, sorted list of
 * upcoming event instances. Deliberately no OAuth, no stored account
 * credentials, no calendar-provider-specific code — just a URL, matching
 * the same trust level as the LHM-URL telemetry source already in this app.
 * `node-ical`'s `expandRecurringEvent()` handles both recurring (RRULE,
 * EXDATE, RECURRENCE-ID overrides) and plain one-off events uniformly, so
 * every VEVENT goes through the same expansion call.
 *
 * Cached per URL for `CACHE_TTL_MS` (an ICS feed doesn't need second-level
 * freshness) — and on a fetch/parse failure, falls back to whatever's still
 * cached (even if stale) rather than blanking a zone that was showing real
 * events a moment ago, only returning empty when there's truly nothing yet.
 */
export async function getAgenda(
  icsUrl: string
): Promise<{ events: CalendarEvent[]; error?: string }> {
  const cached = cache.get(icsUrl)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { events: cached.events }
  }

  try {
    const data = await withTimeout(ical.async.fromURL(icsUrl), FETCH_TIMEOUT_MS)
    const now = new Date()
    const to = new Date(now.getTime() + HORIZON_MS)

    const events: CalendarEvent[] = []
    for (const item of Object.values(data)) {
      if (!item || item.type !== 'VEVENT') continue
      const instances = ical.expandRecurringEvent(item, { from: now, to, expandOngoing: true })
      for (const instance of instances) {
        events.push({
          id: `${item.uid ?? instance.summary}-${instance.start.getTime()}`,
          title: String(instance.summary ?? 'Untitled event'),
          start: instance.start.getTime(),
          end: instance.end.getTime(),
          allDay: instance.isFullDay
        })
      }
    }

    events.sort((a, b) => a.start - b.start)
    const trimmed = events.slice(0, MAX_EVENTS)
    cache.set(icsUrl, { fetchedAt: Date.now(), events: trimmed })
    return { events: trimmed }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (cached) return { events: cached.events, error: message }
    return { events: [], error: message }
  }
}
