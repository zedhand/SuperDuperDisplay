import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { TriggerState } from '@shared/types'

const FLASH_DURATION_MS = 700

interface ActiveFlash {
  key: string
  color: string
}

/**
 * Renders two kinds of trigger effect over the whole panel, purely
 * additively — neither ever blocks the content underneath from being seen:
 * a pulsing colored `glow` (a vignette that stays on for as long as the
 * trigger condition holds, e.g. a red pulse while GPU temp stays over a
 * threshold), and a one-shot `flash` (a brief full-panel color flash that
 * fades out over `FLASH_DURATION_MS`, fired once on the *rising edge* of a
 * trigger becoming active rather than for as long as it stays active —
 * useful for a "something just happened" ping rather than an ongoing
 * warning). Edge detection is done here, client-side, by diffing each
 * incoming `TriggerState` against the previous one, since the main process
 * only reports the trigger's current level (active/inactive), not
 * transitions.
 */
export function AlertOverlay(): ReactElement | null {
  const [state, setState] = useState<TriggerState | null>(null)
  const [flashes, setFlashes] = useState<ActiveFlash[]>([])
  const previouslyActiveRef = useRef<Set<string>>(new Set())

  useEffect(() => window.display.onTriggerState(setState), [])

  useEffect(() => {
    if (!state) return
    const previouslyActive = previouslyActiveRef.current
    const newlyActivated = state.effects.filter(
      (e): e is Extract<TriggerState['effects'][number], { type: 'flash' }> =>
        e.type === 'flash' && !previouslyActive.has(e.triggerId)
    )
    previouslyActiveRef.current = new Set(state.activeTriggerIds)
    if (newlyActivated.length === 0) return

    const additions = newlyActivated.map((e) => ({
      key: `${e.triggerId}-${Date.now()}`,
      color: e.color
    }))
    setFlashes((prev) => [...prev, ...additions])
    additions.forEach((flash) => {
      setTimeout(() => {
        setFlashes((prev) => prev.filter((f) => f.key !== flash.key))
      }, FLASH_DURATION_MS)
    })
  }, [state])

  const glowColors = state?.effects.filter((e) => e.type === 'glow').map((e) => e.color) ?? []
  if (glowColors.length === 0 && flashes.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes superduperdisplay-alert-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.85; }
        }
        @keyframes superduperdisplay-alert-flash {
          0% { opacity: 0.85; }
          100% { opacity: 0; }
        }
      `}</style>
      {glowColors.length > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: glowColors.map((color) => `inset 0 0 60px 10px ${color}`).join(', '),
            animation: 'superduperdisplay-alert-pulse 1.2s ease-in-out infinite'
          }}
        />
      )}
      {flashes.map((flash) => (
        <div
          key={flash.key}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: flash.color,
            animation: `superduperdisplay-alert-flash ${FLASH_DURATION_MS}ms ease-out forwards`
          }}
        />
      ))}
    </>
  )
}
