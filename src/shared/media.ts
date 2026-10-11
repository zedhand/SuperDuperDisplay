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

// Chromium's native <img> formats. TIFF is deliberately excluded — Chromium
// has never supported it.
export const IMAGE_EXTENSIONS = ['gif', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico', 'avif', 'svg']

// Containers Chromium's <video> can demux directly — confirmed live via
// `video.canPlayType()` in this Electron build (see PLAN.md), not assumed
// from docs. Everything else in TRANSCODE_VIDEO_EXTENSIONS gets remuxed or
// transcoded to one of these by src/main/media/transcode.ts before being
// served, since Chromium has no demuxer for those containers at all
// regardless of the codec inside.
export const NATIVE_VIDEO_EXTENSIONS = ['mp4', 'webm']

export const TRANSCODE_VIDEO_EXTENSIONS = [
  'mkv',
  'avi',
  'mov',
  'wmv',
  'flv',
  'mpg',
  'mpeg',
  'm4v',
  'ts',
  'm2ts',
  'mts',
  '3gp',
  '3g2',
  'ogv',
  'vob',
  'asf',
  'm2v',
  'divx'
]

export const VIDEO_EXTENSIONS = [...NATIVE_VIDEO_EXTENSIONS, ...TRANSCODE_VIDEO_EXTENSIONS]

const imageExtSet = new Set(IMAGE_EXTENSIONS)
const videoExtSet = new Set(VIDEO_EXTENSIONS)
const transcodeExtSet = new Set(TRANSCODE_VIDEO_EXTENSIONS)

function extOf(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

export function mediaKindFromPath(path: string): 'video' | 'image' | null {
  const ext = extOf(path)
  if (!ext) return null
  if (videoExtSet.has(ext)) return 'video'
  if (imageExtSet.has(ext)) return 'image'
  return null
}

/** True for a video container Chromium can't demux natively, so it needs the ffmpeg normalize step before it's servable. */
export function needsVideoTranscode(path: string): boolean {
  return transcodeExtSet.has(extOf(path))
}
