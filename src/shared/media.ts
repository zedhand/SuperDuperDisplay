export const MEDIA_PROTOCOL = 'media'

/**
 * Builds a media:// URL for an absolute local file path. The path travels
 * as a query param rather than in the URL's authority/host part, since a
 * Windows drive letter like "C:" there collides with the URL spec's
 * host:port syntax. Pure string logic so both the main process (registering
 * the protocol handler) and the display renderer (setting <video>/<img>
 * src) can share one implementation.
 */
export function toMediaUrl(absolutePath: string): string {
  return `${MEDIA_PROTOCOL}://file?p=${encodeURIComponent(absolutePath)}`
}

const IMAGE_EXTENSIONS = new Set(['gif', 'png', 'jpg', 'jpeg', 'webp'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm'])

export function mediaKindFromPath(path: string): 'video' | 'image' | null {
  const ext = path.split('.').pop()?.toLowerCase()
  if (!ext) return null
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  return null
}
