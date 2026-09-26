import { useEffect, useState, type ReactElement } from 'react'
import type { AppConfig, ColorProfile } from '@shared/types'
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

export function Stage(): ReactElement | null {
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => window.display.onConfigChanged(setConfig), [])

  if (!config) return null
  if (config.display.mode === 'hidden') return null

  const physical = { width: window.innerWidth, height: window.innerHeight }
  const content = rotatedContentSize(physical, config.display.rotation)
  const transform = rotationCssTransform(config.display.rotation)

  const activePreset = config.presets.find((p) => p.id === config.activePresetId)
  const layout = activePreset && config.layouts.find((l) => l.id === activePreset.layoutId)
  const zones = activePreset && layout ? resolveZones(layout, activePreset.zones) : []
  const colorProfile =
    (activePreset && config.colorProfiles.find((c) => c.id === activePreset.colorProfileId)) ??
    NEUTRAL_COLOR_PROFILE

  return (
    <>
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
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: content.width,
          height: content.height,
          transform: `translate(-50%, -50%) ${transform}`.trim(),
          filter: buildColorFilterCss(colorProfile),
          background: '#000',
          overflow: 'hidden'
        }}
      >
        {config.display.mode === 'live' &&
          zones.map((zone) => (
            <div
              key={zone.zoneId}
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
        {config.display.mode === 'live' && <AlertOverlay />}
      </div>
    </>
  )
}
