import { useEffect, useState, type ReactElement } from 'react'
import { ZonePlaceholder } from './ZonePlaceholder'

/** RTSP camera feed, bridged to MJPEG by main/camera/rtsp.ts since Chromium can't play RTSP directly. */
export function RtspZone({ url }: { url: string }): ReactElement {
  const [mjpegUrl, setMjpegUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.display.rtsp.start(url).then(({ mjpegUrl: streamUrl }) => {
      if (!cancelled) setMjpegUrl(streamUrl)
    })
    return () => {
      cancelled = true
      window.display.rtsp.stop(url)
    }
  }, [url])

  if (!mjpegUrl) return <ZonePlaceholder label="Connecting to camera…" />

  return <img src={mjpegUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
}
