import type { ReactElement } from 'react'
import type { AppConfig, ColorProfile } from '@shared/types'
import { resolveZones, rotatedContentSize, rotationCssTransform } from '@shared/layout'
import { buildColorFilterCss, gammaExponent, GAMMA_FILTER_ID } from '@shared/colorProfile'
import { ZoneRenderer } from '@display/zones/ZoneRenderer'

const NEUTRAL_COLOR_PROFILE: ColorProfile = {
  id: 'neutral',
  name: 'Neutral',
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  gamma: 1
}

// Used only to pick the preview box's own aspect ratio when no real panel
// has been matched yet — an arbitrary, common default, not tied to any
// specific hardware.
const FALLBACK_CONTENT_SIZE = { width: 1920, height: 1080 }

/**
 * A live, scaled-down render of the active preset — the same zone tree
 * `Stage.tsx` renders on the real display, minus its power-state gating
 * (a preview should show what *would* render even while the real display
 * is blanked/hidden for power saving, not go blank itself), and always
 * with `ZoneRenderer`'s `isPreview` flag set, since this runs in the
 * control window rather than the display window (see `ZoneRenderer`'s own
 * doc comment for exactly which zone types that affects).
 */
export function ScenePreview({ config }: { config: AppConfig }): ReactElement {
  const activePreset = config.presets.find((p) => p.id === config.activePresetId)
  const layout = activePreset && config.layouts.find((l) => l.id === activePreset.layoutId)
  const zones = activePreset && layout ? resolveZones(layout, activePreset.zones) : []
  const colorProfile =
    (activePreset && config.colorProfiles.find((c) => c.id === activePreset.colorProfileId)) ??
    NEUTRAL_COLOR_PROFILE
  const physical = config.display.match ?? FALLBACK_CONTENT_SIZE
  const content = rotatedContentSize(physical, config.display.rotation)
  const transform = rotationCssTransform(config.display.rotation)
  const aspect = content.width / content.height

  return (
    <div className="flex flex-col gap-2">
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id={GAMMA_FILTER_ID}>
            <feComponentTransfer>
              <feFuncR
                type="gamma"
                amplitude={1}
                exponent={gammaExponent(colorProfile)}
                offset={0}
              />
              <feFuncG
                type="gamma"
                amplitude={1}
                exponent={gammaExponent(colorProfile)}
                offset={0}
              />
              <feFuncB
                type="gamma"
                amplitude={1}
                exponent={gammaExponent(colorProfile)}
                offset={0}
              />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
      <div
        style={{
          width: '100%',
          aspectRatio: aspect,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 8,
          background: '#000',
          filter: buildColorFilterCss(colorProfile),
          transform: transform || undefined
        }}
      >
        {!activePreset && (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-5)]">
            No active scene
          </div>
        )}
        {zones.map((zone) => (
          <div
            key={zone.zoneId}
            style={{
              position: 'absolute',
              left: `${zone.rect.xPct * 100}%`,
              top: `${zone.rect.yPct * 100}%`,
              width: `${zone.rect.wPct * 100}%`,
              height: `${zone.rect.hPct * 100}%`,
              pointerEvents: 'none'
            }}
          >
            <ZoneRenderer zone={zone} isPreview />
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-[var(--text-5)]">{activePreset?.name ?? '—'}</p>
    </div>
  )
}
