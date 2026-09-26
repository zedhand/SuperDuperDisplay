import { useEffect, useRef, type ReactElement } from 'react'

/**
 * Renders an arbitrary web dashboard via Electron's <webview>, not an
 * <iframe> — many dashboard/status pages set X-Frame-Options or a frame-
 * ancestors CSP that blocks iframe embedding outright, while a webview is
 * its own out-of-process browsing context, unaffected by that. It requires
 * `webviewTag: true` on the display window (see windows/displayWindow.ts).
 */
export function WebZone({ url, css }: { url: string; css?: string }): ReactElement {
  const ref = useRef<Electron.WebviewTag>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !css) return
    const onDomReady = (): void => {
      el.insertCSS(css).catch(() => {})
    }
    el.addEventListener('dom-ready', onDomReady)
    return () => {
      el.removeEventListener('dom-ready', onDomReady)
    }
  }, [css])

  return <webview ref={ref} src={url} style={{ width: '100%', height: '100%' }} />
}
