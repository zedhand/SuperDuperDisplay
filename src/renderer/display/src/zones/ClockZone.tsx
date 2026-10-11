import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'

/** Re-renders once per minute, aligned to the minute boundary — not every second, since only HH:MM is ever shown. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const schedule = (): void => {
      const delay = 60_000 - (Date.now() % 60_000)
      timeout = setTimeout(() => {
        setNow(new Date())
        schedule()
      }, delay)
    }
    schedule()
    return () => clearTimeout(timeout)
  }, [])

  return now
}

const ALIGN_TO_ITEMS: Record<'left' | 'center' | 'right', CSSProperties['alignItems']> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end'
}

export function ClockZone({
  format,
  showDate,
  color,
  align
}: {
  format: '12h' | '24h'
  showDate: boolean
  color: string
  align: 'left' | 'center' | 'right'
}): ReactElement {
  const now = useNow()
  const time = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: format === '12h'
  })
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

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
        gap: 'clamp(2px, 2cqh, 12px)',
        padding: 'clamp(4px, 4cqmin, 24px)',
        color,
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          fontSize: 'clamp(20px, 34cqmin, 220px)',
          fontWeight: 700,
          lineHeight: 1,
          whiteSpace: 'nowrap'
        }}
      >
        {time}
      </div>
      {showDate && (
        <div
          style={{
            fontSize: 'clamp(10px, 12cqmin, 64px)',
            opacity: 0.75,
            whiteSpace: 'nowrap'
          }}
        >
          {date}
        </div>
      )}
    </div>
  )
}
