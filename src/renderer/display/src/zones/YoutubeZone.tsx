import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { buildYoutubeEmbedRelayUrl, extractYoutubeId } from '@shared/youtube'
import { ZonePlaceholder } from './ZonePlaceholder'

/**
 * Renders via a <webview> pointed at the public embed-relay page (see
 * shared/youtube.ts) rather than an <iframe> embedding YouTube directly —
 * the relay page owns the cover-crop sizing itself since it's the one that
 * actually knows its own viewport size inside the webview's guest context.
 *
 * `volume` (0-1) only sets the *initial* `?volume=` the relay URL is built
 * with (frozen per `videoId` via `useMemo` — deliberately not re-read on
 * every `volume` change, or the `src` string would change and reload the
 * webview on every tick of a volume slider). Live changes after that go
 * through the relay page's own `window.__setVolume()` (see
 * minidisplay-yt-embed's index.html), called via `webview.executeJavaScript()`,
 * so turning the volume up/down never reloads — and therefore never
 * restarts — the video.
 */
export function YoutubeZone({ url, volume }: { url: string; volume: number }): ReactElement {
  const videoId = extractYoutubeId(url)
  const ref = useRef<Electron.WebviewTag>(null)
  const readyRef = useRef(false)
  // Kept current after every render (in an effect, not during render itself
  // — refs are only safe to write outside of render) so the dom-ready
  // handler (registered once per videoId, fired later and async) reads the
  // volume at the time it actually fires, not whatever it closed over at
  // registration time.
  const volumeRef = useRef(volume)
  useEffect(() => {
    volumeRef.current = volume
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately frozen per videoId, see doc comment above
  const initialVolumePct = useMemo(() => Math.round(volume * 100), [videoId])

  function pushVolume(el: Electron.WebviewTag, vol: number): void {
    el.executeJavaScript(
      `window.__setVolume && window.__setVolume(${Math.round(vol * 100)})`
    ).catch(() => {})
  }

  useEffect(() => {
    readyRef.current = false
    const el = ref.current
    if (!el) return
    const onDomReady = (): void => {
      readyRef.current = true
      pushVolume(el, volumeRef.current)
    }
    el.addEventListener('dom-ready', onDomReady)
    return () => {
      readyRef.current = false
      el.removeEventListener('dom-ready', onDomReady)
    }
  }, [videoId])

  // `executeJavaScript()` throws synchronously — not a rejected promise, an
  // actual thrown error — if the webview's guest hasn't emitted its own
  // 'dom-ready' yet, which crashed the entire display renderer (blank
  // screen, confirmed live) the moment this ran before that event had
  // fired. The dom-ready handler above already pushes whatever
  // `volumeRef.current` is at that point, so skipping here while not ready
  // yet is safe, not a missed update.
  useEffect(() => {
    const el = ref.current
    if (!el || !readyRef.current) return
    pushVolume(el, volume)
  }, [volume, videoId])

  if (!videoId) return <ZonePlaceholder label="Invalid YouTube URL" />

  return (
    <webview
      key={videoId}
      ref={ref}
      src={buildYoutubeEmbedRelayUrl(videoId, initialVolumePct)}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
