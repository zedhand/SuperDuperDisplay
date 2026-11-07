/** Zones offered in the clock/calendar editors. An empty value means "use the system zone". */
export const TIME_ZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'System default' },
  { value: 'America/Whitehorse', label: 'BC / Yukon — UTC-7 year-round' },
  { value: 'America/Vancouver', label: 'Vancouver (Pacific)' },
  { value: 'America/Edmonton', label: 'Edmonton (Mountain)' },
  { value: 'America/Toronto', label: 'Toronto (Eastern)' },
  { value: 'UTC', label: 'UTC' }
]

/** Returns the zone if Intl accepts it, else undefined (= system zone) so a bad value never crashes a zone. */
export function validZone(zone?: string): string | undefined {
  if (!zone) return undefined
  try {
    new Intl.DateTimeFormat([], { timeZone: zone })
    return zone
  } catch {
    return undefined
  }
}
