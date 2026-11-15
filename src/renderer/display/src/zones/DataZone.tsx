import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'

const ALIGN_TO_ITEMS: Record<'left' | 'center' | 'right', CSSProperties['alignItems']> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end'
}

/** One value pulled from a JSON URL (Home Assistant sensor, Discord online count, Twitch viewers, ...), refreshed on an interval. */
export function DataZone({
  url,
  headers,
  path,
  label,
  unit,
  color,
  align,
  intervalSec
}: {
  url: string
  headers: string
  path: string
  label: string
  unit: string
  color: string
  align: 'left' | 'center' | 'right'
  intervalSec: number
}): ReactElement {
  const [value, setValue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!url.trim()) return
    let cancelled = false
    const load = (): void => {
      window.display.data.get(url, headers, path).then((r) => {
        if (cancelled) return
        if (r.value != null) setValue(r.value)
        setError(r.error ?? null)
      })
    }
    load()
    const id = setInterval(load, Math.max(5, intervalSec) * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [url, headers, path, intervalSec])

  return (
    <div
      style={{
        containerType: 'size',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: ALIGN_TO_ITEMS[align],
        justifyContent: 'center',
        gap: 'clamp(2px, 3cqh, 16px)',
        padding: 'clamp(4px, 4cqmin, 24px)',
        boxSizing: 'border-box',
        color,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        overflow: 'hidden'
      }}
    >
      {label && (
        <div style={{ fontSize: 'clamp(10px, 14cqh, 56px)', opacity: 0.7, whiteSpace: 'nowrap' }}>
          {label}
        </div>
      )}
      <div
        style={{
          fontSize: 'clamp(14px, min(40cqh, 12cqw), 220px)',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%'
        }}
      >
        {!url.trim() ? 'Set a URL' : value == null ? '—' : `${value}${unit ? ` ${unit}` : ''}`}
      </div>
      {error && (
        <div style={{ fontSize: 'clamp(8px, 8cqh, 24px)', opacity: 0.5, whiteSpace: 'nowrap' }}>
          {error}
        </div>
      )}
    </div>
  )
}
