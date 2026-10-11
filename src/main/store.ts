import { app } from 'electron'
import { existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Store from 'electron-store'
import { appConfigSchema, defaultConfig, CONFIG_VERSION } from '@shared/schema'
import type { AppConfig } from '@shared/types'

/**
 * One-time migration for the SuperDuperDisplay rebrand: electron-store's
 * default `cwd` is `app.getPath('userData')`, which Electron derives from
 * package.json's `name` field — so renaming it (minidisplay ->
 * superduperdisplay) points every existing install at a brand-new, empty
 * userData folder unless handled explicitly, silently dropping every
 * preset/layout/trigger/schedule a user already built. If the new userData
 * folder has no `config.json` yet but the old sibling `minidisplay` folder
 * does, copy it over (never move — the legacy file is left untouched in
 * case anything here goes wrong). A no-op on every later launch, once the
 * new folder has its own `config.json`.
 */
function migrateLegacyConfigIfNeeded(): void {
  try {
    const newUserData = app.getPath('userData')
    const newConfigPath = join(newUserData, 'config.json')
    if (existsSync(newConfigPath)) return
    const legacyConfigPath = join(dirname(newUserData), 'minidisplay', 'config.json')
    if (!existsSync(legacyConfigPath)) return
    mkdirSync(newUserData, { recursive: true })
    copyFileSync(legacyConfigPath, newConfigPath)
    console.log(
      '[store] migrated config from legacy MiniDisplay install:',
      legacyConfigPath,
      '->',
      newConfigPath
    )
  } catch (err) {
    console.warn('[store] legacy config migration failed (non-fatal):', err)
  }
}

migrateLegacyConfigIfNeeded()

const store = new Store<{ config: AppConfig }>({
  defaults: { config: defaultConfig }
})

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** One level deep merge: nested config sections (display, power, ...) merge key-by-key; arrays and primitives are replaced wholesale. */
function mergeConfig(base: AppConfig, patch: Partial<AppConfig>): AppConfig {
  const result: Record<string, unknown> = { ...(base as unknown as Record<string, unknown>) }
  for (const [key, value] of Object.entries(patch)) {
    const existing = (base as unknown as Record<string, unknown>)[key]
    result[key] =
      isPlainObject(existing) && isPlainObject(value) ? { ...existing, ...value } : value
  }
  return result as unknown as AppConfig
}

export function getConfig(): AppConfig {
  const raw = store.get('config')
  const parsed = appConfigSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  console.warn(
    '[store] persisted config failed validation, resetting to defaults',
    parsed.error.message
  )
  store.set('config', defaultConfig)
  return defaultConfig
}

export function setConfig(patch: Partial<AppConfig>): AppConfig {
  const merged = mergeConfig(getConfig(), patch)
  merged.version = CONFIG_VERSION
  const parsed = appConfigSchema.parse(merged)
  store.set('config', parsed)
  return parsed
}

/** Wholesale replace, not a merge — for importing a full config backup. Validates before writing, so a malformed/foreign file can't corrupt the store. */
export function replaceConfig(candidate: unknown): AppConfig {
  const parsed = appConfigSchema.parse({ ...(candidate as object), version: CONFIG_VERSION })
  store.set('config', parsed)
  return parsed
}
