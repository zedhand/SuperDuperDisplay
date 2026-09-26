import Store from 'electron-store'
import { appConfigSchema, defaultConfig, CONFIG_VERSION } from '@shared/schema'
import type { AppConfig } from '@shared/types'

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
