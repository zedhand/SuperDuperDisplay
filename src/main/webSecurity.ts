import { app, session } from 'electron'

/** Web zones and the YouTube relay run in this isolated, persistent session — not the app's own — so embedded third-party pages can't reach app-only resources (the media:// protocol) or be granted app permissions. */
export const GUEST_PARTITION = 'persist:guest-pages'

/**
 * Electron grants every permission by default unless a handler says
 * otherwise. The app's own windows only ever need `media` (the Camera
 * zone's getUserMedia); embedded guest pages get nothing.
 */
export function registerMediaPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media'
  })
  const guest = session.fromPartition(GUEST_PARTITION)
  guest.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  guest.setPermissionCheckHandler(() => false)
}

/**
 * Electron's documented webview hardening: strip any preload/node-
 * integration a webview tag's attributes might request, force guest pages
 * into the isolated guest session, and only allow http(s) navigation —
 * since the URL loaded there is a value the user types into the Web zone's
 * settings, not content the app itself controls.
 */
export function registerWebviewHardening(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      delete webPreferences.preload
      webPreferences.nodeIntegration = false
      webPreferences.contextIsolation = true
      webPreferences.sandbox = true
      params.partition = GUEST_PARTITION
      if (!/^https?:\/\//.test(params.src)) {
        event.preventDefault()
      }
    })
  })
}
