import { globalShortcut } from 'electron'
import type { AppConfig, DisplayMode } from '@shared/types'

/**
 * Global (system-wide, works even when the control window isn't focused —
 * it's normally minimized to tray) shortcuts: Ctrl/Cmd+Alt+1-9 activates
 * the preset at that position, Ctrl/Cmd+Alt+L/B/D switches to live/black/
 * desktop (hidden) mode. Re-registering on every config change would be
 * wasteful (and could momentarily drop a held key), so this only actually
 * touches `globalShortcut` when the relevant inputs — whether hotkeys are
 * enabled at all, and the ordered list of preset ids — actually changed
 * since last time.
 */
let lastSignature = ''

export function updateHotkeys(
  config: AppConfig,
  onActivatePreset: (presetId: string) => void,
  onSetMode: (mode: DisplayMode) => void
): void {
  const presetIds = config.presets.slice(0, 9).map((p) => p.id)
  const signature = JSON.stringify({ enabled: config.app.hotkeysEnabled, presetIds })
  if (signature === lastSignature) return
  lastSignature = signature

  globalShortcut.unregisterAll()
  if (!config.app.hotkeysEnabled) return

  presetIds.forEach((presetId, i) => {
    globalShortcut.register(`CommandOrControl+Alt+${i + 1}`, () => onActivatePreset(presetId))
  })
  globalShortcut.register('CommandOrControl+Alt+L', () => onSetMode('live'))
  globalShortcut.register('CommandOrControl+Alt+B', () => onSetMode('black'))
  globalShortcut.register('CommandOrControl+Alt+D', () => onSetMode('hidden'))
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
  lastSignature = ''
}
