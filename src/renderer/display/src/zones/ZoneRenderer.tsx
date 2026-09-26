import type { ReactElement } from 'react'
import type { ResolvedZone } from '@shared/types'
import { mediaKindFromPath, toMediaUrl } from '@shared/media'
import { MediaZone } from './MediaZone'
import { ZonePlaceholder } from './ZonePlaceholder'

export function ZoneRenderer({ zone }: { zone: ResolvedZone }): ReactElement {
  const { source } = zone

  switch (source.type) {
    case 'media': {
      const path = source.path
      const kind = path ? mediaKindFromPath(path) : null
      if (!path || !kind) {
        return (
          <ZonePlaceholder
            label={source.folder ? 'Folder playlist (coming soon)' : 'No media selected'}
          />
        )
      }
      return (
        <MediaZone
          item={{ src: toMediaUrl(path), kind }}
          fit={source.fit}
          bg={source.bg}
          bgColor={source.bgColor}
        />
      )
    }
    case 'blank':
      return <div style={{ width: '100%', height: '100%', background: '#000' }} />
    case 'youtube':
      return <ZonePlaceholder label="YouTube (coming soon)" />
    case 'web':
      return <ZonePlaceholder label="Web embed (coming soon)" />
    case 'stats':
      return <ZonePlaceholder label="Hardware stats (coming soon)" />
    case 'camera':
      return <ZonePlaceholder label="Camera (coming soon)" />
  }
}
