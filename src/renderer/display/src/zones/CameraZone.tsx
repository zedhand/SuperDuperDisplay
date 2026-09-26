import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ZonePlaceholder } from './ZonePlaceholder'

/** Live USB webcam feed via getUserMedia — no deviceId means "use the system default camera." Requires the `media` permission granted in main/webSecurity.ts. */
export function CameraZone({ deviceId }: { deviceId?: string }): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((track) => track.stop())
          return
        }
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [deviceId])

  if (error) return <ZonePlaceholder label={`Camera error: ${error}`} />

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}
