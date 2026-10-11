import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import type { NowPlayingInfo } from '@shared/types'

const ALIGN_TO_ITEMS: Record<'left' | 'center' | 'right', CSSProperties['alignItems']> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end'
}

const STATUS_ICON: Record<NowPlayingInfo['status'], string> = {
  playing: '▶',
  paused: '⏸',
  stopped: '■',
  unknown: '♪'
}

export function NowPlayingZone({
  color,
  align
}: {
  color: string
  align: 'left' | 'center' | 'right'
}): ReactElement {
  const [info, setInfo] = useState<NowPlayingInfo | null>(null)

  useEffect(() => window.display.onNowPlaying(setInfo), [])

  const active = info?.active ?? false
  const title = info?.title || info?.appId || 'Nothing playing'
  const artist = info?.artist

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
        gap: 'clamp(2px, 2cqh, 10px)',
        padding: 'clamp(4px, 4cqmin, 24px)',
        color,
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
        opacity: active ? 1 : 0.45
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(4px, 3cqmin, 16px)',
          maxWidth: '100%'
        }}
      >
        {active && info && (
          <span style={{ fontSize: 'clamp(10px, 12cqmin, 48px)', lineHeight: 1 }}>
            {STATUS_ICON[info.status]}
          </span>
        )}
        <span
          style={{
            fontSize: 'clamp(14px, 20cqmin, 96px)',
            fontWeight: 700,
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%'
          }}
        >
          {title}
        </span>
      </div>
      {active && artist && (
        <div
          style={{
            fontSize: 'clamp(10px, 12cqmin, 56px)',
            opacity: 0.75,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%'
          }}
        >
          {artist}
        </div>
      )}
    </div>
  )
}
