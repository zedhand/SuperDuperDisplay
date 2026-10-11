import { useEffect, useState, type ReactElement } from 'react'
import type { AppConfig, ColorProfile, ResolvedZone } from '@shared/types'
import { resolveZones, rotatedContentSize, rotationCssTransform } from '@shared/layout'
import { buildColorFilterCss, gammaExponent, GAMMA_FILTER_ID } from '@shared/colorProfile'
import { ZoneRenderer } from './zones/ZoneRenderer'
import { AlertOverlay } from './fx/AlertOverlay'

const NEUTRAL_COLOR_PROFILE: ColorProfile = {
  id: 'neutral',
  name: 'Neutral',
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  gamma: 1
}

interface TransitionLayer {
  presetId: string
  visible: boolean
}

/**
 * Tracks a small stack of presets currently being crossfaded between,
 * keyed by preset id — resolved fresh from the *current* config every
 * render rather than snapshotted, so a zone edit made mid-transition (or
 * even to the outgoing preset) is never stale. Only `config.activePresetId`
 * changing adds a new layer / starts the fade; content-only config changes
 * update the already-tracked layers in place without retriggering one.
 * With `transitionMs` at its default of 0, the "fade" is instant (a CSS
 * `transition: opacity 0ms`), matching the original cut-only behavior
 * exactly — this is opt-in, not a change to existing setups.
 */
function useTransitionLayers(
  activePresetId: string | undefined,
  transitionMs: number
): TransitionLayer[] {
  const [layers, setLayers] = useState<TransitionLayer[]>([])
  const [trackedPresetId, setTrackedPresetId] = useState<string | undefined>(undefined)

  // Adjusting state during render (React's documented pattern for "derive
  // state from a prop change") rather than in an effect: computing the next
  // `layers` value needs the previously *committed* layers array, which an
  // effect can only reach via a synchronous setState call at its top level —
  // exactly the pattern this project's lint rules flag as likely to cause
  // cascading renders. Guarded by the `trackedPresetId` comparison, so this
  // only actually runs once per real preset change, not every render.
  //
  // The outgoing layer(s) are deliberately left alone here, still fully
  // visible — confirmed live that setting them to `visible: false` in this
  // same step (the first version of this code) made both layers invisible
  // simultaneously for a moment, so the "crossfade" was actually a flash to
  // black followed by the new content fading in from nothing, not a real
  // cross-fade. The new layer renders on top (later in the array = later in
  // the DOM = higher paint order) starting invisible, fades in over the old
  // one via the effect below, and only the old layer is removed — by then
  // fully hidden underneath — once the transition finishes.
  if (activePresetId && activePresetId !== trackedPresetId) {
    setTrackedPresetId(activePresetId)
    setLayers((prev) => {
      if (prev.some((l) => l.presetId === activePresetId)) return prev
      return [...prev, { presetId: activePresetId, visible: false }]
    })
  }

  useEffect(() => {
    if (!activePresetId) return
    // A *double* rAF, not one — confirmed live this actually matters: with a
    // single rAF, the new layer's `opacity: 0` never gets an actual paint
    // before the callback flips it to `opacity: 1` in the same or very next
    // frame, so the CSS `transition` has no prior painted value to animate
    // from and just jumps straight to the end state (a screenshot taken
    // immediately after switching presets showed the incoming preset already
    // fully opaque, with a 6-SECOND transition configured). The first rAF
    // callback runs before the upcoming paint with the layer still at
    // opacity 0 — that paint happens — and only the rAF scheduled *inside*
    // it flips visibility, guaranteeing a real 0-opacity frame was rendered
    // first.
    let raf2: number | null = null
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setLayers((prev) =>
          prev.map((l) => (l.presetId === activePresetId ? { ...l, visible: true } : l))
        )
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2 != null) cancelAnimationFrame(raf2)
    }
  }, [activePresetId])

  useEffect(() => {
    if (!activePresetId) return
    const timeout = setTimeout(() => {
      setLayers((prev) => prev.filter((l) => l.presetId === activePresetId))
    }, transitionMs + 50)
    return () => clearTimeout(timeout)
  }, [activePresetId, transitionMs])

  return layers
}

function resolveScene(
  config: AppConfig,
  presetId: string
): { zones: ResolvedZone[]; colorProfile: ColorProfile } | null {
  const preset = config.presets.find((p) => p.id === presetId)
  const layout = preset && config.layouts.find((l) => l.id === preset.layoutId)
  if (!preset || !layout) return null
  return {
    zones: resolveZones(layout, preset.zones),
    colorProfile:
      config.colorProfiles.find((c) => c.id === preset.colorProfileId) ?? NEUTRAL_COLOR_PROFILE
  }
}

export function Stage(): ReactElement | null {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const layers = useTransitionLayers(config?.activePresetId, config?.display.transitionMs ?? 0)

  useEffect(() => {
    // The main process only pushes on config changes (and once, on its own
    // did-finish-load) — if this component hasn't subscribed by the time
    // that fires, the initial config is missed for good. Actively fetching
    // it here as well closes that race, same as the control window already
    // does for window.control.config.
    window.display.getConfig().then(setConfig)
    return window.display.onConfigChanged(setConfig)
  }, [])

  if (!config) return null
  if (config.display.mode === 'hidden') return null

  const physical = { width: window.innerWidth, height: window.innerHeight }
  const content = rotatedContentSize(physical, config.display.rotation)
  const transform = rotationCssTransform(config.display.rotation)
  // Every layer references the same filter id, so only the currently-active
  // preset's gamma value applies to all of them — gamma differing between
  // two presets mid-crossfade is a minor visual nuance, not a correctness
  // issue, and it avoids per-layer filter-id bookkeeping for a transition
  // that's over within a second either way.
  const activeColorProfile =
    resolveScene(config, config.activePresetId)?.colorProfile ?? NEUTRAL_COLOR_PROFILE

  return (
    <>
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id={GAMMA_FILTER_ID}>
            <feComponentTransfer>
              <feFuncR
                type="gamma"
                amplitude={1}
                exponent={gammaExponent(activeColorProfile)}
                offset={0}
              />
              <feFuncG
                type="gamma"
                amplitude={1}
                exponent={gammaExponent(activeColorProfile)}
                offset={0}
              />
              <feFuncB
                type="gamma"
                amplitude={1}
                exponent={gammaExponent(activeColorProfile)}
                offset={0}
              />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: content.width,
          height: content.height,
          transform: `translate(-50%, -50%) ${transform}`.trim(),
          background: '#000',
          overflow: 'hidden'
        }}
      >
        {config.display.mode === 'live' &&
          layers.map((layer) => {
            const scene = resolveScene(config, layer.presetId)
            if (!scene) return null
            return (
              <div
                key={layer.presetId}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: layer.visible ? 1 : 0,
                  transition: `opacity ${config.display.transitionMs}ms linear`,
                  filter: buildColorFilterCss(scene.colorProfile)
                }}
              >
                {scene.zones.map((zone) => (
                  <div
                    key={zone.zoneId}
                    data-zone-id={zone.zoneId}
                    style={{
                      position: 'absolute',
                      left: `${zone.rect.xPct * 100}%`,
                      top: `${zone.rect.yPct * 100}%`,
                      width: `${zone.rect.wPct * 100}%`,
                      height: `${zone.rect.hPct * 100}%`
                    }}
                  >
                    <ZoneRenderer zone={zone} />
                  </div>
                ))}
              </div>
            )
          })}
        {config.display.mode === 'live' && <AlertOverlay />}
      </div>
    </>
  )
}
