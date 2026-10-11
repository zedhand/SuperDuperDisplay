import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { ffmpegPath } from '../media/ffmpegPath'

const BOUNDARY = 'superduperdisplay-frame'

interface ActiveStream {
  process: ChildProcessWithoutNullStreams
  clients: Set<ServerResponse>
}

/**
 * Bridges an RTSP camera into something Chromium can actually display:
 * Chromium has no RTSP support at all, so ffmpeg re-encodes it as
 * multipart MJPEG (`-f mpjpeg`) piped over a plain localhost HTTP server,
 * which any <img> tag can just point at. One ffmpeg process is shared
 * across every client currently viewing the same RTSP URL.
 */
export class RtspManager {
  private streams = new Map<string, ActiveStream>()
  private server: Server | null = null
  private port = 0

  async start(rtspUrl: string): Promise<{ mjpegUrl: string }> {
    const port = await this.ensureServer()
    if (!this.streams.has(rtspUrl)) {
      this.spawnFfmpeg(rtspUrl)
    }
    return { mjpegUrl: `http://127.0.0.1:${port}/stream?src=${encodeURIComponent(rtspUrl)}` }
  }

  stop(rtspUrl: string): void {
    const stream = this.streams.get(rtspUrl)
    if (!stream) return
    stream.process.kill()
    for (const res of stream.clients) res.end()
    this.streams.delete(rtspUrl)
  }

  stopAll(): void {
    for (const url of [...this.streams.keys()]) this.stop(url)
    this.server?.close()
    this.server = null
  }

  private spawnFfmpeg(rtspUrl: string): void {
    const proc = spawn(ffmpegPath, [
      '-rtsp_transport',
      'tcp',
      '-i',
      rtspUrl,
      '-f',
      'mpjpeg',
      '-boundary_tag',
      BOUNDARY,
      '-q:v',
      '5',
      '-r',
      '15',
      'pipe:1'
    ])
    const clients = new Set<ServerResponse>()

    proc.stdout.on('data', (chunk: Buffer) => {
      for (const res of clients) res.write(chunk)
    })
    proc.on('exit', () => this.streams.delete(rtspUrl))
    proc.stderr.on('data', () => {
      // ffmpeg logs progress/diagnostics to stderr even on success; intentionally not surfaced per-line
    })

    this.streams.set(rtspUrl, { process: proc, clients })
  }

  private ensureServer(): Promise<number> {
    if (this.server) return Promise.resolve(this.port)
    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => this.handleRequest(req, res))
      server.on('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        this.port = typeof address === 'object' && address ? address.port : 0
        this.server = server
        resolve(this.port)
      })
    })
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '', 'http://127.0.0.1')
    const rtspUrl = url.searchParams.get('src')
    const stream = rtspUrl ? this.streams.get(rtspUrl) : undefined
    if (!stream) {
      res.writeHead(404)
      res.end()
      return
    }
    res.writeHead(200, { 'Content-Type': `multipart/x-mixed-replace; boundary=${BOUNDARY}` })
    stream.clients.add(res)
    req.on('close', () => stream.clients.delete(res))
  }
}
