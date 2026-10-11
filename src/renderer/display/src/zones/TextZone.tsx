import type { CSSProperties, ReactElement } from 'react'

const ALIGN_TO_ITEMS: Record<'left' | 'center' | 'right', CSSProperties['alignItems']> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end'
}
const ALIGN_TO_TEXT: Record<'left' | 'center' | 'right', CSSProperties['textAlign']> = {
  left: 'left',
  center: 'center',
  right: 'right'
}

/** A static custom-text zone/layer — the non-time-derived counterpart to ClockZone, for labels, a name plate, or any fixed message. */
export function TextZone({
  content,
  color,
  align,
  scale,
  bold
}: {
  content: string
  color: string
  align: 'left' | 'center' | 'right'
  scale: number
  bold: boolean
}): ReactElement {
  return (
    <div
      style={{
        containerType: 'size',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: ALIGN_TO_ITEMS[align],
        justifyContent: 'center',
        padding: 'clamp(4px, 4cqmin, 24px)',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          fontSize: `clamp(${10 * scale}px, ${20 * scale}cqmin, ${160 * scale}px)`,
          fontWeight: bold ? 700 : 400,
          color,
          textAlign: ALIGN_TO_TEXT[align],
          fontFamily: 'system-ui, sans-serif',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.2
        }}
      >
        {content}
      </div>
    </div>
  )
}
