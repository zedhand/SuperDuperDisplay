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
 * Builds a chromeless, autoplaying, muted, looping embed URL. `loop=1`
 * only actually loops a single video when paired with `playlist=<same id>`
 * — an easy-to-miss YouTube iframe API quirk. youtube-nocookie.com is used
 * for privacy. The player also rejects this app's file:// origin outright
 * (embed error 153) unless `origin` here matches the Referer header
 * main/webSecurity.ts's registerYoutubeEmbedReferer() adds to the request.
 */
export function buildYoutubeEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    loop: '1',
    playlist: videoId,
    controls: '0',
    modestbranding: '1',
    rel: '0',
    iv_load_policy: '3',
    playsinline: '1',
    // Matches the Referer header main/webSecurity.ts adds to this same
    // request — the player checks that these two agree.
    origin: 'https://www.youtube.com'
  })
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}
