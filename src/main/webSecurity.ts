import { app, session } from 'electron'

/**
 * Electron grants permission requests (camera, mic, etc) by default. The
 * Camera zone and the control window's camera picker need `media` for
 * `getUserMedia`, so that one is allowed, but only for the app's own
 * windows: Web and YouTube zones are <webview>s sharing this same session,
 * and a site typed into a Web zone must not get silent camera/mic access.
 * Everything else is denied.
 */
export function registerMediaPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' && webContents.getType() === 'window')
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
