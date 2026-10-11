import { useEffect, useState, type ReactElement } from 'react'
import type { FeedItem } from '@shared/types'

const POLL_MS = 10 * 60 * 1000

/** Same dual-window lookup as the calendar agenda: `window.display` in the display window, `window.control` in the control window's previews. */
function getRssApi(): {
  get: (feedUrl: string) => Promise<{ title: string; items: FeedItem[]; error?: string }>
} | null {
  return window.display?.rss ?? window.control?.rss ?? null
}

function timeAgo(published: number | null): string | null {
  if (published === null) return null
  const minutes = Math.round((Date.now() - published) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

/**
 * Headlines from an RSS or Atom feed, fetched and parsed by the main
 * process (feeds almost never send CORS headers). `list` shows as many as
 * fit; `rotate` shows one headline large and cycles through them.
 */
export function RssZone({
  feedUrl,
  mode,
  color,
  maxItems,
  intervalSec
}: {
  feedUrl: string
  mode: 'list' | 'rotate'
  color: string
  maxItems: number
  intervalSec: number
}): ReactElement {
  // Keyed by the feed it came from, so switching feeds shows "Loading…" rather than the old feed's headlines.
  const [result, setResult] = useState<{
    feedUrl: string
    title: string
    items: FeedItem[]
    error: string | null
  } | null>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const api = getRssApi()
    if (!feedUrl.trim() || !api) return
    let cancelled = false
    const load = (): void => {
      api.get(feedUrl).then((res) => {
        if (cancelled) return
        setResult({ feedUrl, title: res.title, items: res.items, error: res.error ?? null })
      })
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [feedUrl])

  const current = result?.feedUrl === feedUrl ? result : null
  const items = current?.items ?? null
  const title = current?.title ?? ''
  const error = current?.error ?? null
  const shown = (items ?? []).slice(0, Math.max(1, maxItems))

  useEffect(() => {
    if (mode !== 'rotate' || shown.length < 2) return
    const id = setInterval(
      () => setIndex((i) => (i + 1) % shown.length),
      Math.max(2, intervalSec) * 1000
    )
    return () => clearInterval(id)
  }, [mode, shown.length, intervalSec])

  const container = (children: ReactElement): ReactElement => (
    <div
      style={{
        containerType: 'size',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: mode === 'rotate' ? 'center' : 'flex-start',
        gap: 'clamp(3px, 2cqh, 12px)',
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
    container(<div style={{ fontSize: 'clamp(9px, 5cqmin, 20px)', opacity: 0.6 }}>{text}</div>)

  if (!feedUrl.trim()) return message('No feed URL set')
  if (items === null) return message('Loading…')
  if (shown.length === 0) return message(error ? "Couldn't load feed" : 'No headlines')

  const header = title ? (
    <div
      style={{
        fontSize: 'clamp(8px, 4.5cqmin, 18px)',
        opacity: 0.55,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}
    >
      {title}
    </div>
  ) : null

  if (mode === 'rotate') {
    const item = shown[index % shown.length]
    const ago = timeAgo(item.published)
    return container(
      <>
        {header}
        <div
          key={item.id}
          style={{
            fontSize: 'clamp(12px, 10cqmin, 56px)',
            fontWeight: 700,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {item.title}
        </div>
        {ago && <div style={{ fontSize: 'clamp(8px, 4.5cqmin, 18px)', opacity: 0.55 }}>{ago}</div>}
      </>
    )
  }

  return container(
    <>
      {header}
      {shown.map((item) => {
        const ago = timeAgo(item.published)
        return (
          <div
            key={item.id}
            style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(4px, 2cqw, 12px)' }}
          >
            <span
              style={{
                fontSize: 'clamp(9px, 5.5cqmin, 22px)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0
              }}
            >
              {item.title}
            </span>
            {ago && (
              <span
                style={{
                  fontSize: 'clamp(8px, 4.5cqmin, 18px)',
                  opacity: 0.55,
                  flexShrink: 0
                }}
              >
                {ago}
              </span>
            )}
          </div>
        )
      })}
    </>
  )
}
