import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import type { Telemetry } from '@shared/types'
import { getMetricDef } from '@shared/telemetryMetrics'

function formatValue(value: number | null, unit: string): string {
  if (value == null) return '—'
  return `${Math.round(value)}${unit}`
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
          fontSize: 'clamp(14px, 38cqh, 96px)',
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
        gap: 'clamp(8px, 2cqmin, 24px)'
      }}
    >
      <svg
        viewBox="0 0 72 72"
        style={{ width: 'clamp(100px, 42cqmin, 320px)', height: 'clamp(100px, 42cqmin, 320px)' }}
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
      <span style={{ fontSize: 'clamp(18px, 7.5cqmin, 56px)', color: '#ccc' }}>{def.label}</span>
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
        fontSize: 'clamp(14px, 46cqh, 96px)',
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

export function StatsZone({
  widgets,
  style
}: {
  widgets: string[]
  style: 'bars' | 'gauges' | 'compact'
}): ReactElement {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)

  useEffect(() => window.display.onTelemetry(setTelemetry), [])

  const Row = style === 'gauges' ? GaugeRow : style === 'compact' ? CompactRow : BarRow

  let listStyle: CSSProperties
  if (style === 'gauges') {
    listStyle = {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 'clamp(16px, 6cqmin, 56px)',
      alignItems: 'center',
      justifyContent: 'center'
    }
  } else {
    // bars/compact stack vertically with no wrapping, so a long widget list
    // would just keep growing taller than the zone. Split into columns of
    // ~4 rows each so it always fits instead of overflowing top and bottom.
    const columns = Math.max(1, Math.ceil(widgets.length / 4))
    const rows = Math.max(1, Math.ceil(widgets.length / columns))
    listStyle = {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gridAutoFlow: 'column',
      gap: 'clamp(8px, 2cqmin, 32px)',
      width: '100%',
      height: '100%'
    }
  }

  return (
    <div
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
