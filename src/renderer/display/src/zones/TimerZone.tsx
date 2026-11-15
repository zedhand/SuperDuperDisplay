import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import { formatDuration, timerState, type TimerMode } from '@shared/timerMath'

// The display page loads when the app starts, so this is "time since SuperDuperDisplay launched".
const SESSION_START = Date.now() - Math.round(performance.now())

const ALIGN_TO_ITEMS: Record<'left' | 'center' | 'right', CSSProperties['alignItems']> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end'
}

export function TimerZone({
  mode,
  target,
  label,
  color,
  align
}: {
  mode: TimerMode
  target?: string
  label: string
  color: string
  align: 'left' | 'center' | 'right'
}): ReactElement {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const state = timerState(mode, target, now, SESSION_START)

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
          fontSize: 'clamp(14px, min(40cqh, 14cqw), 220px)',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap'
        }}
      >
        {state == null ? 'Set a date' : state.done ? 'Done' : formatDuration(state.ms, true)}
      </div>
    </div>
  )
}
