import { app, session } from 'electron'

/**
 * Electron denies every permission request (camera, mic, etc) by default.
 * The Camera zone needs `media` for `getUserMedia` to work at all; nothing
 * else the app loads (local files, YouTube embeds, arbitrary webviews)
 * asks for a permission that should be silently granted, so this only
 * allows that one.
 */
export function registerMediaPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })
}

/**
 * Electron's documented webview hardening: strip any preload/node-
 * integration a webview tag's attributes might request, and only allow it
 * to navigate to http(s) — since the URL loaded there is a value the user
 * types into the Web zone's settings, not content the app itself controls.
 */
export function registerWebviewHardening(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      delete webPreferences.preload
      webPreferences.nodeIntegration = false
      webPreferences.contextIsolation = true
      webPreferences.sandbox = true
      if (!/^https?:\/\//.test(params.src)) {
        event.preventDefault()
      }
    })
  })
}

/**
 * The YouTube zone's iframe is served from this app's file:// origin,
 * which YouTube's embed player rejects outright (error 153, "video player
 * configuration error") — it expects a real http(s) Referer. Rewriting it
 * to a generic https origin for just the embed request satisfies that
 * check without needing to serve the app itself over http.
 */
export function registerYoutubeEmbedReferer(): void {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*', '*://*.ytimg.com/*'] },
    (details, callback) => {
      details.requestHeaders['Referer'] = 'https://www.youtube.com/'
      callback({ requestHeaders: details.requestHeaders })
    }
  )
}
