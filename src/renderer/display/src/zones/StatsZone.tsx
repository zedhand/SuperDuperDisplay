import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import type { Telemetry } from '@shared/types'
import { getMetricDef } from '@shared/telemetryMetrics'

function formatValue(value: number | null, unit: string): string {
  if (value == null) return '—'
  return `${Math.round(value)}${unit}`
}

/**
 * A label or value is a single unbreakable run of text, so no amount of
 * font-size guessing from character counts is bulletproof — an unusually
 * long label at an unlucky size could still overflow. `nowrap` + ellipsis
 * is the hard backstop: worst case it truncates cleanly instead of
 * wrapping into (and visually overlapping) whatever's in the next cell,
 * which is what an unclipped multi-line wrap actually did before this.
 */
function ellipsisStyle(cqh: number, cqw: number, min: number, max: number): CSSProperties {
  return {
    fontSize: `max(${min}px, min(${cqh}cqh, ${cqw}cqw, ${max}px))`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%'
  }
}

const BAR_LABEL_STYLE: CSSProperties = { ...ellipsisStyle(18, 14, 9, 28), color: '#aaa' }
const BAR_VALUE_STYLE: CSSProperties = {
  ...ellipsisStyle(38, 18, 16, 88),
  color: '#fff',
  fontWeight: 700
}
const COMPACT_LABEL_STYLE: CSSProperties = { ...ellipsisStyle(22, 16, 9, 32), color: '#aaa' }
const COMPACT_VALUE_STYLE: CSSProperties = {
  ...ellipsisStyle(48, 20, 18, 96),
  color: '#fff',
  fontWeight: 700
}

/** Measures an element's rendered pixel size, updating on resize. */
function useElementSize<T extends HTMLElement>(): [
  (node: T | null) => void,
  { width: number; height: number }
] {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const observerRef = useRef<ResizeObserver | null>(null)

  const setRef = (node: T | null): void => {
    observerRef.current?.disconnect()
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(node)
    observerRef.current = observer
  }

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return [setRef, size]
}

/**
 * Picks how many columns to arrange `count` cells into, given the actual
 * pixel space available and each cell's natural width:height ratio — by
 * trying every column count and keeping whichever one lets a cell grow
 * largest without overflowing either axis. This is what actually makes a
 * widget list "auto-scale" to a zone's real shape (a full-bleed 1920x480
 * zone and a narrow 30%-width column need very different grids for the same
 * 8 widgets) instead of assuming one fixed layout.
 */
function pickColumns(count: number, width: number, height: number, cellAspect: number): number {
  if (count <= 1 || width <= 0 || height <= 0) return 1

  let bestColumns = 1
  let bestScale = -Infinity
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns)
    const cellWidth = width / columns
    const cellHeight = height / rows
    const scale = Math.min(cellWidth / cellAspect, cellHeight)
    if (scale > bestScale) {
      bestScale = scale
      bestColumns = columns
    }
  }
  return bestColumns
}

function BarRow({
  telemetry,
  metricKey
}: {
  telemetry: Telemetry | null
  metricKey: string
}): ReactElement | null {
  const def = getMetricDef(metricKey)
  if (!def) return null
  const value = telemetry ? def.getValue(telemetry) : null
  const pct = value == null ? 0 : Math.min(100, Math.max(0, (value / def.max) * 100))

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 'clamp(2px, 4cqh, 10px)',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        containerType: 'size'
      }}
    >
      <div style={BAR_LABEL_STYLE}>{def.label}</div>
      <div style={{ ...BAR_VALUE_STYLE, marginBottom: 'clamp(2px, 2cqh, 8px)' }}>
        {formatValue(value, def.unit)}
      </div>
      <div
        style={{
          height: 'clamp(6px, 12cqh, 28px)',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
          flexShrink: 0
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #e879f9, #a855f7)',
            transition: 'width 400ms ease-out'
          }}
        />
      </div>
    </div>
  )
}

function GaugeRow({
  telemetry,
  metricKey
}: {
  telemetry: Telemetry | null
  metricKey: string
}): ReactElement | null {
  const def = getMetricDef(metricKey)
  if (!def) return null
  const value = telemetry ? def.getValue(telemetry) : null
  const pct = value == null ? 0 : Math.min(100, Math.max(0, (value / def.max) * 100))
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct / 100)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(4px, 3cqh, 24px)',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        containerType: 'size'
      }}
    >
      <svg
        viewBox="0 0 72 72"
        style={{ width: 'clamp(48px, 75cqmin, 320px)', height: 'clamp(48px, 75cqmin, 320px)' }}
      >
        <circle
          cx={36}
          cy={36}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={6}
        />
        <circle
          cx={36}
          cy={36}
          r={radius}
          fill="none"
          stroke="#e879f9"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 400ms ease-out' }}
        />
        <text x={36} y={40} textAnchor="middle" fontSize={14} fill="#fff" fontWeight={600}>
          {value == null ? '—' : Math.round(value)}
        </text>
      </svg>
      <span style={{ ...ellipsisStyle(14, 16, 8, 40), color: '#ccc' }}>{def.label}</span>
    </div>
  )
}

function CompactRow({
  telemetry,
  metricKey
}: {
  telemetry: Telemetry | null
  metricKey: string
}): ReactElement | null {
  const def = getMetricDef(metricKey)
  if (!def) return null
  const value = telemetry ? def.getValue(telemetry) : null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 'clamp(2px, 4cqh, 10px)',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        containerType: 'size'
      }}
    >
      <div style={COMPACT_LABEL_STYLE}>{def.label}</div>
      <div style={COMPACT_VALUE_STYLE}>{formatValue(value, def.unit)}</div>
    </div>
  )
}

/** How much wider than tall one cell naturally wants to be, per style — used to pick a grid that fits the zone's actual shape. */
const CELL_ASPECT: Record<'bars' | 'gauges' | 'compact', number> = {
  bars: 1.8, // stacked label/value/bar — only needs to fit one string's width at a time
  gauges: 0.85,
  compact: 2.4 // stacked label/value, no bar
}

export function StatsZone({
  widgets,
  style
}: {
  widgets: string[]
  style: 'bars' | 'gauges' | 'compact'
}): ReactElement {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [sizeRef, { width, height }] = useElementSize<HTMLDivElement>()

  useEffect(() => window.display.onTelemetry(setTelemetry), [])

  const Row = style === 'gauges' ? GaugeRow : style === 'compact' ? CompactRow : BarRow

  const columns = useMemo(
    () => pickColumns(widgets.length, width, height, CELL_ASPECT[style]),
    [widgets.length, width, height, style]
  )
  const rows = Math.max(1, Math.ceil(widgets.length / columns))

  const listStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gridAutoFlow: 'column',
    gap: 'clamp(8px, 2cqmin, 32px)',
    width: '100%',
    height: '100%'
  }

  return (
    <div
      ref={sizeRef}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: 'clamp(16px, 6cqmin, 64px)',
        background: '#0d0d10',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        containerType: 'size'
      }}
    >
      <div style={listStyle}>
        {widgets.map((key) => (
          <Row key={key} telemetry={telemetry} metricKey={key} />
        ))}
      </div>
    </div>
  )
}
