import { useEffect, useState, type ReactElement } from 'react'
import type { TriggerState } from '@shared/types'

/** Pulsing colored glow drawn over the whole panel for any active 'glow' trigger effect (e.g. a red pulse when GPU temp crosses a threshold). Purely additive — it never blocks the content underneath from being seen. */
export function AlertOverlay(): ReactElement | null {
  const [state, setState] = useState<TriggerState | null>(null)

  useEffect(() => window.display.onTriggerState(setState), [])

  const glowColors = state?.effects.filter((e) => e.type === 'glow').map((e) => e.color) ?? []
  if (glowColors.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes minidisplay-alert-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.85; }
        }
      `}</style>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          boxShadow: glowColors.map((color) => `inset 0 0 60px 10px ${color}`).join(', '),
          animation: 'minidisplay-alert-pulse 1.2s ease-in-out infinite'
        }}
      />
    </>
  )
}
