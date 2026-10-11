import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * Checks GitHub releases for a newer build, downloads it in the background
 * and installs it on the next quit, with a system notification when one is
 * ready. Beta builds (versions like 1.0.0-beta.1) also pick up newer betas;
 * stable builds only see stable releases. Skipped in dev, where there's no
 * packaged app to replace.
 */
export function startAutoUpdates(): void {
  if (!app.isPackaged) return

  autoUpdater.allowPrerelease = app.getVersion().includes('-')
  autoUpdater.on('error', (err) => console.warn('[updater]', err.message))

  const check = (): void => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => console.warn('[updater]', err.message))
  }
  check()
  setInterval(check, CHECK_INTERVAL_MS).unref()
}
