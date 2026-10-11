import { app } from 'electron'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { mkdir, readdir, rename, stat, unlink, utimes } from 'fs/promises'
import { join } from 'path'
import { ffmpegPath } from './ffmpegPath'

/**
 * Normalizes a video file Chromium can't demux natively (mkv, avi, mov,
 * wmv, ...) into a cached .mp4 it can play, via the ffmpeg binary already
 * bundled for the RTSP camera bridge (src/main/camera/rtsp.ts).
 *
 * Cached by a hash of the source path + size + mtime, so editing/replacing
 * a source file invalidates its cache entry automatically. Concurrent
 * requests for the same file share one ffmpeg run instead of racing.
 *
 * Capped at `MAX_CACHE_BYTES` total, LRU-evicted: a cache hit bumps the
 * file's mtime to "now" (there's no reliable last-*accessed*-time signal —
 * NTFS has atime updates disabled by default), so mtime doubles as
 * last-used time, and pruning deletes oldest-mtime entries first once the
 * cache exceeds budget. Pruning runs opportunistically after each new file
 * is cached, not on a timer — this cache is small/personal (ambient looping
 * clips), so "occasionally overshoots budget by one write" is a fine
 * tradeoff for not needing a background process.
 */

const inFlight = new Map<string, Promise<string>>()
const MAX_CACHE_BYTES = 2 * 1024 * 1024 * 1024 // 2GB

function cacheDir(): string {
  return join(app.getPath('userData'), 'mediaCache')
}

async function cacheKeyFor(absolutePath: string): Promise<string> {
  const info = await stat(absolutePath)
  return createHash('sha1').update(`${absolutePath}|${info.size}|${info.mtimeMs}`).digest('hex')
}

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args)
    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code === 0) resolve(stderr)
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-2000)}`))
    })
  })
}

// Codecs Chromium can actually decode. A container-level `-c copy` remux can
// succeed (exit 0) for codecs Chromium still can't play (mpeg2video, vc1,
// wmv3, ...) since ffmpeg only checks the codec fits the mp4 box, not
// whether Chromium can decode it — confirmed live: a `-c copy` remux of an
// mpeg2video/mp2 source produced a valid .mp4 that ffmpeg accepted but
// Chromium's <video> refused with MEDIA_ELEMENT_ERROR. So the codec must be
// checked before deciding to remux.
const PLAYABLE_VIDEO_CODECS = new Set(['h264', 'hevc', 'vp8', 'vp9', 'av1'])
const PLAYABLE_AUDIO_CODECS = new Set([
  'aac',
  'mp3',
  'opus',
  'vorbis',
  'flac',
  'pcm_s16le',
  'pcm_s24le'
])

/** Reads codec names straight from ffmpeg's own stream-probe stderr output (`Stream #0:0: Video: h264 ...`) — no ffprobe binary is bundled, so this avoids adding one just for a codec name. */
async function probeCodecs(
  sourcePath: string
): Promise<{ video: string | null; audio: string | null }> {
  let stderr: string
  try {
    await runFfmpeg(['-i', sourcePath, '-hide_banner'])
    stderr = ''
  } catch (err) {
    stderr = (err as Error).message
  }
  const video = /Stream #\d+:\d+.*: Video: (\w+)/.exec(stderr)?.[1] ?? null
  const audio = /Stream #\d+:\d+.*: Audio: (\w+)/.exec(stderr)?.[1] ?? null
  return { video, audio }
}

/**
 * Remuxes (`-c copy`, near-instant, no quality loss) when the source's own
 * codecs are already Chromium-playable and only the container needs
 * changing. Otherwise transcodes to h264/aac, which covers everything else
 * ffmpeg can decode (MPEG-2, VC-1, WMV, DivX, ...).
 */
async function normalize(sourcePath: string, outPath: string): Promise<void> {
  const common = ['-y', '-i', sourcePath, '-map', '0:v:0', '-map', '0:a:0?']
  const { video, audio } = await probeCodecs(sourcePath)
  const canRemux =
    !!video && PLAYABLE_VIDEO_CODECS.has(video) && (!audio || PLAYABLE_AUDIO_CODECS.has(audio))

  if (canRemux) {
    try {
      await runFfmpeg([...common, '-c', 'copy', '-movflags', '+faststart', outPath])
      return
    } catch {
      // fall through to a real transcode below
    }
  }

  await runFfmpeg([
    ...common,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outPath
  ])
}

/** Deletes oldest-mtime `.mp4` entries until the cache is back under `MAX_CACHE_BYTES`. Best-effort — a failure here should never break video playback. */
async function pruneCache(): Promise<void> {
  try {
    const dir = cacheDir()
    const names = (await readdir(dir)).filter((n) => n.endsWith('.mp4') && !n.endsWith('.tmp.mp4'))
    const entries = await Promise.all(
      names.map(async (name) => {
        const path = join(dir, name)
        const info = await stat(path)
        return { path, size: info.size, mtimeMs: info.mtimeMs }
      })
    )
    let total = entries.reduce((sum, e) => sum + e.size, 0)
    if (total <= MAX_CACHE_BYTES) return

    entries.sort((a, b) => a.mtimeMs - b.mtimeMs)
    for (const entry of entries) {
      if (total <= MAX_CACHE_BYTES) break
      await unlink(entry.path).catch(() => {})
      total -= entry.size
    }
  } catch {
    // cacheDir not created yet, or a transient fs error — nothing to prune
  }
}

/** Returns an absolute path to a Chromium-playable .mp4 for the given source, transcoding/caching on first use. */
export async function getPlayableVideoPath(sourcePath: string): Promise<string> {
  const key = await cacheKeyFor(sourcePath)
  const finalPath = join(cacheDir(), `${key}.mp4`)

  try {
    await stat(finalPath)
    const now = new Date()
    await utimes(finalPath, now, now).catch(() => {}) // mark as recently used for LRU pruning
    return finalPath
  } catch {
    // not cached yet
  }

  const existing = inFlight.get(key)
  if (existing) return existing

  const task = (async (): Promise<string> => {
    await mkdir(cacheDir(), { recursive: true })
    const tmpPath = join(cacheDir(), `${key}.tmp.mp4`)
    try {
      await normalize(sourcePath, tmpPath)
      await rename(tmpPath, finalPath)
      pruneCache() // fire-and-forget: eviction being slightly delayed doesn't matter
      return finalPath
    } catch (err) {
      await unlink(tmpPath).catch(() => {})
      throw err
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, task)
  return task
}
