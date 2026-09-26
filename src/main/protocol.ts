import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { MEDIA_PROTOCOL } from '@shared/media'

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
 */
export function registerMediaProtocolHandler(): void {
  protocol.handle(MEDIA_PROTOCOL, (request) => {
    const url = new URL(request.url)
    const absolutePath = url.searchParams.get('p')
    if (!absolutePath) {
      return new Response('Missing path', { status: 400 })
    }
    return net.fetch(pathToFileURL(absolutePath).toString(), {
      headers: request.headers
    })
  })
}
