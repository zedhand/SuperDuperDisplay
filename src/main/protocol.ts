import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { MEDIA_PROTOCOL, needsVideoTranscode } from '@shared/media'
import { getPlayableVideoPath } from './media/transcode'

/** Must run before app.whenReady(). Registers media:// as a privileged scheme so <video>/<img> can load it and issue Range requests for seeking. */
export function registerMediaProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

/**
 * Must run after app.whenReady(). Serves local files by absolute path,
 * passed as a query param (media://file?p=<encoded-path>) rather than in
 * the authority/host part of the URL, since a Windows drive letter like
 * "C:" there collides with the URL spec's host:port syntax. net.fetch on a
 * file: URL natively supports Range requests, which video seeking and
 * looping depend on.
 *
 * A container Chromium can't demux at all (mkv, avi, mov, ...) is
 * transparently swapped for a cached, normalized .mp4 of the same content
 * before being served — the renderer never knows the difference, it just
 * gets a media:// URL that plays.
 */
export function registerMediaProtocolHandler(): void {
  protocol.handle(MEDIA_PROTOCOL, async (request) => {
    const url = new URL(request.url)
    const absolutePath = url.searchParams.get('p')
    if (!absolutePath) {
      return new Response('Missing path', { status: 400 })
    }
    let servedPath = absolutePath
    if (needsVideoTranscode(absolutePath)) {
      try {
        servedPath = await getPlayableVideoPath(absolutePath)
      } catch (err) {
        return new Response(`Transcode failed: ${(err as Error).message}`, { status: 500 })
      }
    }
    return net.fetch(pathToFileURL(servedPath).toString(), {
      headers: request.headers
    })
  })
}
