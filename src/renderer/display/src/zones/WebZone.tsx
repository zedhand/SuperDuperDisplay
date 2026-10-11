import { useEffect, useRef, type ReactElement } from 'react'

/**
 * Renders an arbitrary web dashboard via Electron's <webview>, not an
 * <iframe> — many dashboard/status pages set X-Frame-Options or a frame-
 * ancestors CSP that blocks iframe embedding outright, while a webview is
 * its own out-of-process browsing context, unaffected by that. It requires
 * `webviewTag: true` on the display window (see windows/displayWindow.ts).
 *
 * Muted by default, like every other zone type (media/camera/YouTube) —
 * this is meant as a passive ambient display, not a sound source. Unlike a
 * <video> element, a <webview> has no `muted` HTML attribute or fractional
 * volume — Electron only exposes a binary `setAudioMuted()`, so `volume`
 * here is 0 (muted) vs. anything above 0 (unmuted), not a real level.
 * Matters in practice: pointing this zone straight at a youtube.com URL
 * (instead of the dedicated YouTube zone type, which can set a real
 * volume) plays YouTube's ad audio completely unmuted without this.
 */
export function WebZone({
  url,
  css,
  volume
}: {
  url: string
  css?: string
  volume: number
}): ReactElement {
  const ref = useRef<Electron.WebviewTag>(null)
  const readyRef = useRef(false)
  // Kept current after every render (in an effect, not during render itself
  // — refs are only safe to write outside of render) so the dom-ready
  // handler (registered once, fired later and async) reads the volume at
  // the time it actually fires, not whatever it closed over at
  // registration time.
  const volumeRef = useRef(volume)
  useEffect(() => {
    volumeRef.current = volume
  })

  useEffect(() => {
    readyRef.current = false
    const el = ref.current
    if (!el) return
    const onDomReady = (): void => {
      readyRef.current = true
      el.setAudioMuted(volumeRef.current <= 0)
      if (css) el.insertCSS(css).catch(() => {})
    }
    el.addEventListener('dom-ready', onDomReady)
    return () => {
      readyRef.current = false
      el.removeEventListener('dom-ready', onDomReady)
    }
  }, [css])

  // `setAudioMuted()` throws synchronously — not a rejected promise, an
  // actual thrown error — if the webview's guest hasn't emitted its own
  // 'dom-ready' yet, which crashed the entire display renderer (blank
  // screen, confirmed live) the moment this ran on mount before that event
  // had fired. The dom-ready handler above already applies whatever
  // `volumeRef.current` is at that point, so skipping here while not ready
  // yet is safe, not a missed update.
  useEffect(() => {
    if (!readyRef.current) return
    ref.current?.setAudioMuted(volume <= 0)
  }, [volume])

  return <webview ref={ref} src={url} style={{ width: '100%', height: '100%' }} />
}
