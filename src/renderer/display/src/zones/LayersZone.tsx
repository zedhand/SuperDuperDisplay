import type { ReactElement } from 'react'
import type { LayerItem } from '@shared/types'
import { layerFilterCss } from '@shared/layerFilter'
import { ZoneRenderer } from './ZoneRenderer'

/**
 * Renders each layer in its own free-form absolutely-positioned box
 * (fractions of this zone's own rect, so they scale correctly whether this
 * zone is full-bleed or one column of a split layout) through the *same*
 * `ZoneRenderer` a top-level zone uses — a layer is just a `ZoneSource` in
 * a box, not a separate rendering implementation per source type. This is
 * what makes a resizable YouTube layer and a resizable GIF layer the same
 * mechanism, and what lets a `layers` item itself be `type: 'layers'` for
 * free (nesting isn't a special case, just a consequence of reusing the
 * union).
 */
export function LayersZone({
  items,
  isPreview
}: {
  items: LayerItem[]
  isPreview?: boolean
}): ReactElement {
  const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {sorted.map((item) => (
        <div
          key={item.id}
          data-zone-id={item.id}
          style={{
            position: 'absolute',
            left: `${item.x * 100}%`,
            top: `${item.y * 100}%`,
            width: `${item.width * 100}%`,
            height: `${item.height * 100}%`,
            opacity: item.opacity,
            filter: layerFilterCss(item.filter)
          }}
        >
          <ZoneRenderer
            zone={{
              zoneId: item.id,
              rect: { xPct: item.x, yPct: item.y, wPct: item.width, hPct: item.height },
              source: item.source
            }}
            isPreview={isPreview}
          />
        </div>
      ))}
    </div>
  )
}
