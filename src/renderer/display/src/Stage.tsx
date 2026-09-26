import { useEffect, useState, type ReactElement } from 'react'
import type { AppConfig } from '@shared/types'
import { resolveZones, rotatedContentSize, rotationCssTransform } from '@shared/layout'
import { ZoneRenderer } from './zones/ZoneRenderer'

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

  return (
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
    </div>
  )
}
