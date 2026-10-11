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
import { ClockZone } from './ClockZone'
import { CalendarZone } from './CalendarZone'
import { NowPlayingZone } from './NowPlayingZone'
import { WeatherZone } from './WeatherZone'
import { RssZone } from './RssZone'
import { TextZone } from './TextZone'
import { ColorZone } from './ColorZone'
import { LayersZone } from './LayersZone'
import { ZonePlaceholder } from './ZonePlaceholder'

/**
 * `isPreview` is set when this renders inside the *control* window (the
 * layers canvas editor, the live preview pane) rather than the real
 * display window. A few zone types read `window.display.*` preload APIs
 * that only exist in the display window's context — a folder media
 * playlist (watches folders via the main process), stats (telemetry
 * ticks), an RTSP camera (the ffmpeg→MJPEG bridge), and now-playing (SMTC
 * ticks) — and would throw if actually rendered there. Everything else (a
 * fixed media file, YouTube, a web dashboard, a USB camera, clock,
 * calendar — including its agenda mode, which calls a plain invoke exposed
 * in both preloads rather than a display-only push channel — weather and
 * RSS (same plain-invoke pattern), and layers
 * zones recursively) has no such dependency and renders exactly the same,
 * real content either way — so the control window's previews are genuine
 * WYSIWYG wherever that's possible, and a clear placeholder only where
 * it's genuinely not.
 */
export function ZoneRenderer({
  zone,
  isPreview
}: {
  zone: ResolvedZone
  isPreview?: boolean
}): ReactElement {
  const { source } = zone

  switch (source.type) {
    case 'media': {
      if (source.folder) {
        if (isPreview) return <ZonePlaceholder label="Folder playlist" />
        return (
          <FolderMediaZone
            folder={source.folder}
            shuffle={source.shuffle}
            intervalSec={source.intervalSec}
            fit={source.fit}
            bg={source.bg}
            bgColor={source.bgColor}
            volume={source.volume}
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
          volume={source.volume}
          loop={source.loop}
          trimStart={source.trimStart}
          trimEnd={source.trimEnd}
        />
      )
    }
    case 'blank':
      return <div style={{ width: '100%', height: '100%', background: '#000' }} />
    case 'youtube':
      return source.url ? (
        <YoutubeZone url={source.url} volume={source.volume} />
      ) : (
        <ZonePlaceholder label="No YouTube URL set" />
      )
    case 'web':
      return source.url ? (
        <WebZone url={source.url} css={source.css} volume={source.volume} />
      ) : (
        <ZonePlaceholder label="No URL set" />
      )
    case 'stats':
      if (isPreview) return <ZonePlaceholder label="Stats" />
      return <StatsZone widgets={source.widgets} style={source.style} />
    case 'camera':
      if (source.rtspUrl) {
        if (isPreview) return <ZonePlaceholder label="RTSP camera" />
        return <RtspZone url={source.rtspUrl} />
      }
      return <CameraZone deviceId={source.deviceId} />
    case 'clock':
      return (
        <ClockZone
          format={source.format}
          showDate={source.showDate}
          color={source.color}
          align={source.align}
        />
      )
    case 'calendar':
      return (
        <CalendarZone accentColor={source.accentColor} mode={source.mode} icsUrl={source.icsUrl} />
      )
    case 'weather':
      return (
        <WeatherZone
          location={source.location}
          units={source.units}
          color={source.color}
          showForecast={source.showForecast}
        />
      )
    case 'rss':
      return (
        <RssZone
          feedUrl={source.feedUrl}
          mode={source.mode}
          color={source.color}
          maxItems={source.maxItems}
          intervalSec={source.intervalSec}
        />
      )
    case 'nowplaying':
      if (isPreview) return <ZonePlaceholder label="Now playing" />
      return <NowPlayingZone color={source.color} align={source.align} />
    case 'text':
      return (
        <TextZone
          content={source.content}
          color={source.color}
          align={source.align}
          scale={source.scale}
          bold={source.bold}
        />
      )
    case 'color':
      return (
        <ColorZone
          mode={source.mode}
          colorA={source.colorA}
          colorB={source.colorB}
          angle={source.angle}
        />
      )
    case 'layers':
      return <LayersZone items={source.items} isPreview={isPreview} />
  }
}
