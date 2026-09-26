import type { ReactElement } from 'react'

/** Stands in for zone types not built yet (youtube, web, stats, camera) so the layout engine is fully exercisable before each one lands. */
export function ZonePlaceholder({ label }: { label: string }): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#151515',
        color: '#555',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 14,
        border: '1px dashed #333',
        boxSizing: 'border-box'
      }}
    >
      {label}
    </div>
  )
}
