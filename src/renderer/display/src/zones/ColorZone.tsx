import type { ReactElement } from 'react'

/** A plain solid color or linear gradient — for when a background is wanted without an actual image file. */
export function ColorZone({
  mode,
  colorA,
  colorB,
  angle
}: {
  mode: 'solid' | 'gradient'
  colorA: string
  colorB: string
  angle: number
}): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: mode === 'solid' ? colorA : `linear-gradient(${angle}deg, ${colorA}, ${colorB})`
      }}
    />
  )
}
