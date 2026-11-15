import { execFile } from 'child_process'
import type { AppConfig, AppRule } from '@shared/types'

const POLL_MS = 3000

function normalizeExe(name: string): string {
  const n = name.trim().toLowerCase()
  return n.endsWith('.exe') ? n : `${n}.exe`
}

/** First enabled rule whose process is currently running, or null. Pure, so it's unit-testable. */
export function findActiveRule(rules: AppRule[], running: Set<string>): AppRule | null {
  for (const rule of rules) {
    if (!rule.enabled || !rule.exe.trim()) continue
    if (running.has(normalizeExe(rule.exe))) return rule
  }
  return null
}

/** Parses `tasklist /FO CSV /NH` output into a set of lowercase image names. */
export function parseTasklist(csv: string): Set<string> {
  const names = new Set<string>()
  for (const line of csv.split(/\r?\n/)) {
    const m = /^"([^"]+)"/.exec(line)
    if (m) names.add(m[1].toLowerCase())
  }
  return names
}

export interface AppWatcherActions {
  setMouseLock: (on: boolean) => void
  setPreset: (presetId: string) => void
}

/**
 * Polls the process list and, while a configured app is running, applies
 * its rule (mouse lock and/or scene). When the app exits, only the things
 * the rule itself changed are undone — and only if the user hasn't changed
 * them again in the meantime.
 */
export class AppWatcher {
  private timer: NodeJS.Timeout | null = null
  private active: AppRule | null = null
  private restore: { lockMouse?: boolean; presetId?: string } = {}
  private busy = false

  constructor(
    private getConfig: () => AppConfig,
    private actions: AppWatcherActions
  ) {}

  start(): void {
    if (process.platform !== 'win32' || this.timer) return
    this.timer = setInterval(() => void this.tick(), POLL_MS)
    void this.tick()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async tick(): Promise<void> {
    if (this.busy) return
    const config = this.getConfig()
    if (config.appRules.length === 0 && !this.active) return
    this.busy = true
    try {
      const running = await listProcesses()
      this.evaluate(config, running)
    } catch {
      // tasklist unavailable/failed: leave state as is and try again next tick
    } finally {
      this.busy = false
    }
  }

  evaluate(config: AppConfig, running: Set<string>): void {
    const next = findActiveRule(config.appRules, running)
    if (next?.id === this.active?.id) return

    if (this.active) this.undo(config)
    this.active = next
    if (!next) return

    this.restore = {}
    if (next.lockMouse && !config.display.lockMouse) {
      this.restore.lockMouse = false
      this.actions.setMouseLock(true)
    }
    if (next.presetId && next.presetId !== config.activePresetId) {
      this.restore.presetId = config.activePresetId
      this.actions.setPreset(next.presetId)
    }
  }

  private undo(config: AppConfig): void {
    const rule = this.active
    if (!rule) return
    if (this.restore.lockMouse === false && config.display.lockMouse) {
      this.actions.setMouseLock(false)
    }
    if (
      this.restore.presetId &&
      rule.presetId === config.activePresetId &&
      config.presets.some((p) => p.id === this.restore.presetId)
    ) {
      this.actions.setPreset(this.restore.presetId)
    }
    this.restore = {}
  }
}

function listProcesses(): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    execFile(
      'tasklist',
      ['/FO', 'CSV', '/NH'],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(parseTasklist(stdout)))
    )
  })
}
