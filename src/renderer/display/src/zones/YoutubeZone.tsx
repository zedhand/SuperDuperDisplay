import { useEffect, useRef, useState, type ReactElement } from 'react'
import { buildYoutubeEmbedUrl, extractYoutubeId } from '@shared/youtube'
import { ZonePlaceholder } from './ZonePlaceholder'

const VIDEO_ASPECT = 16 / 9

/**
 * Sizes an element to "cover" its parent at a fixed aspect ratio (like
 * object-fit: cover, but for something that isn't a <video>/<img> and so
 * can't use object-fit itself — an iframe's box is what has an intrinsic
 * size, YouTube's own player just fills it). Cropped centrally by wrapping
 * in an overflow:hidden container and centering an oversized element.
 */
function useCoverSize(
  containerRef: React.RefObject<HTMLDivElement | null>,
  aspect: number
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = (): void => {
      const { clientWidth: cw, clientHeight: ch } = el
      if (cw === 0 || ch === 0) return
      const containerAspect = cw / ch
      setSize(
        containerAspect > aspect
          ? { width: cw, height: cw / aspect }
          : { width: ch * aspect, height: ch }
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [containerRef, aspect])

  return size
}

export function YoutubeZone({ url }: { url: string }): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const size = useCoverSize(containerRef, VIDEO_ASPECT)
  const videoId = extractYoutubeId(url)

  if (!videoId) return <ZonePlaceholder label="Invalid YouTube URL" />

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#000'
      }}
    >
      {size.width > 0 && (
        <iframe
          key={videoId}
          src={buildYoutubeEmbedUrl(videoId)}
          title="YouTube ambient background"
          allow="autoplay; encrypted-media"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: size.width,
            height: size.height,
            transform: 'translate(-50%, -50%)',
            border: 'none',
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  )
}
