import { useEffect, useState, type ReactElement } from 'react'
import type { AppConfig } from '@shared/types'
import { rotatedContentSize, rotationCssTransform } from '@shared/layout'

export function Stage(): ReactElement | null {
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => window.display.onConfigChanged(setConfig), [])

  if (!config) return null
  if (config.display.mode === 'hidden') return null

  const physical = { width: window.innerWidth, height: window.innerHeight }
  const content = rotatedContentSize(physical, config.display.rotation)
  const transform = rotationCssTransform(config.display.rotation)

  const activePreset = config.presets.find((p) => p.id === config.activePresetId)

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: content.width,
        height: content.height,
        transform: `translate(-50%, -50%) ${transform}`,
        background: config.display.mode === 'black' ? '#000' : '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: Math.max(12, Math.min(content.width, content.height) * 0.04)
      }}
    >
      {config.display.mode === 'live' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#e879f9', fontWeight: 600 }}>MiniDisplay</div>
          <div style={{ marginTop: 4, fontSize: '0.7em' }}>{activePreset?.name ?? 'No preset'}</div>
          <div style={{ marginTop: 8, fontSize: '0.6em', opacity: 0.6 }}>
            {content.width}×{content.height} · rotation {config.display.rotation}°
          </div>
        </div>
      )}
    </div>
  )
}
