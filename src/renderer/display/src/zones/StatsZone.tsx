import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import type { Telemetry } from '@shared/types'
import { getMetricDef } from '@shared/telemetryMetrics'

function formatValue(value: number | null, unit: string): string {
  if (value == null) return '—'
  return `${Math.round(value)}${unit}`
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
        gap: 'clamp(4px, 6cqh, 20px)',
        minWidth: 0,
        minHeight: 0,
        containerType: 'size'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          // A label + value ("GPU Clock" / "3800MHz") is unbreakable text
          // sharing one row, so its size has to respect the row's width too
          // — cqh alone let it fit height-wise while still overflowing a
          // narrow column horizontally.
          fontSize: 'max(11px, min(38cqh, 11cqw, 96px))',
          color: '#ccc'
        }}
      >
        <span>{def.label}</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{formatValue(value, def.unit)}</span>
      </div>
      <div
        style={{
          height: 'clamp(6px, 14cqh, 36px)',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden'
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
      <span style={{ fontSize: 'max(8px, min(14cqh, 16cqw, 40px))', color: '#ccc' }}>
        {def.label}
      </span>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 'max(11px, min(46cqh, 11cqw, 96px))',
        minWidth: 0,
        minHeight: 0,
        containerType: 'size'
      }}
    >
      <span style={{ color: '#ccc' }}>{def.label}</span>
      <span style={{ color: '#fff', fontWeight: 600 }}>{formatValue(value, def.unit)}</span>
    </div>
  )
}

/** How much wider than tall one cell naturally wants to be, per style — used to pick a grid that fits the zone's actual shape. */
const CELL_ASPECT: Record<'bars' | 'gauges' | 'compact', number> = {
  bars: 3.2,
  gauges: 0.85,
  compact: 5
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
