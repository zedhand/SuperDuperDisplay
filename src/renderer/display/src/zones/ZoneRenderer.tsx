import type { ReactElement } from 'react'
import type { ResolvedZone } from '@shared/types'
import { mediaKindFromPath, toMediaUrl } from '@shared/media'
import { MediaZone } from './MediaZone'
import { FolderMediaZone } from './FolderMediaZone'
import { YoutubeZone } from './YoutubeZone'
import { WebZone } from './WebZone'
import { StatsZone } from './StatsZone'
import { CameraZone } from './CameraZone'
import { RtspZone } from './RtspZone'
import { ZonePlaceholder } from './ZonePlaceholder'

export function ZoneRenderer({ zone }: { zone: ResolvedZone }): ReactElement {
  const { source } = zone

  switch (source.type) {
    case 'media': {
      if (source.folder) {
        return (
          <FolderMediaZone
            folder={source.folder}
            shuffle={source.shuffle}
            intervalSec={source.intervalSec}
            fit={source.fit}
            bg={source.bg}
            bgColor={source.bgColor}
          />
        )
      }
      const path = source.path
      const kind = path ? mediaKindFromPath(path) : null
      if (!path || !kind) {
        return <ZonePlaceholder label="No media selected" />
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
      return source.url ? (
        <YoutubeZone url={source.url} />
      ) : (
        <ZonePlaceholder label="No YouTube URL set" />
      )
    case 'web':
      return source.url ? (
        <WebZone url={source.url} css={source.css} />
      ) : (
        <ZonePlaceholder label="No URL set" />
      )
    case 'stats':
      return <StatsZone widgets={source.widgets} style={source.style} />
    case 'camera':
      if (source.rtspUrl) return <RtspZone url={source.rtspUrl} />
      return <CameraZone deviceId={source.deviceId} />
  }
}
