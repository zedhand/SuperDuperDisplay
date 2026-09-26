import { useEffect, useState, type ReactElement } from 'react'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 1cqmin, 12px)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'clamp(14px, 4.5cqmin, 44px)',
          color: '#ccc'
        }}
      >
        <span>{def.label}</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{formatValue(value, def.unit)}</span>
      </div>
      <div
        style={{
          height: 'clamp(6px, 1.6cqmin, 20px)',
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
        gap: 'clamp(4px, 1cqmin, 12px)'
      }}
    >
      <svg
        viewBox="0 0 72 72"
        style={{ width: 'clamp(72px, 20cqmin, 220px)', height: 'clamp(72px, 20cqmin, 220px)' }}
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
      <span style={{ fontSize: 'clamp(12px, 3.5cqmin, 32px)', color: '#ccc' }}>{def.label}</span>
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
        justifyContent: 'space-between',
        fontSize: 'clamp(14px, 4.5cqmin, 44px)'
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
  const listStyle =
    style === 'gauges'
      ? {
          display: 'flex' as const,
          flexDirection: 'row' as const,
          flexWrap: 'wrap' as const,
          gap: 'clamp(12px, 3cqmin, 40px)',
          alignItems: 'center',
          justifyContent: 'center'
        }
      : {
          display: 'flex' as const,
          flexDirection: 'column' as const,
          gap: 'clamp(8px, 2cqmin, 28px)',
          width: '100%'
        }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: 'clamp(12px, 3cqmin, 48px)',
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
