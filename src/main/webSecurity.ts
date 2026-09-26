import { app } from 'electron'

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
