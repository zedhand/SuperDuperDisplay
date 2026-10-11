const YOUTUBE_ID_PATTERNS = [
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/
]

/** Accepts a full YouTube URL (watch/embed/shorts/youtu.be, with or without extra query params) or a bare 11-char video id. */
export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * YouTube's embed player rejects this app's own file:// (or dev-mode
 * localhost) origin outright as the parent of its iframe — error 152-4,
 * "video unavailable" — no matter what Referer/origin header is spoofed on
 * the request; this was tested directly and ruled out. The only working
 * fix is for the iframe's actual top-level navigation to be a real public
 * https origin. `superduperdisplay-yt-embed` is a small static page (source:
 * https://github.com/zedhand/superduperdisplay-yt-embed) hosted on GitHub Pages
 * for exactly that: it takes `?v=<id>` and embeds the video itself, so
 * YoutubeZone.tsx loads *this* page in a <webview> instead of embedding
 * YouTube directly.
 */
const YOUTUBE_EMBED_RELAY_URL = 'https://zedhand.github.io/superduperdisplay-yt-embed/'

/** `initialVolumePct` (0-100) only sets the *starting* volume/mute state — live changes after that go through the relay page's own `window.__setVolume()`, called via `webview.executeJavaScript()`, so turning the volume up/down never reloads (and restarts) the video. */
export function buildYoutubeEmbedRelayUrl(videoId: string, initialVolumePct: number): string {
  return `${YOUTUBE_EMBED_RELAY_URL}?v=${encodeURIComponent(videoId)}&volume=${initialVolumePct}`
}
