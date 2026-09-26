import { create } from 'zustand'
import type { AppConfig } from '@shared/types'

interface ConfigStore {
  config: AppConfig | null
  setConfig: (config: AppConfig) => void
  patch: (partial: Partial<AppConfig>) => Promise<void>
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: null,
  setConfig: (config) => set({ config }),
  patch: async (partial) => {
    const next = await window.control.config.set(partial)
    set({ config: next })
  }
}))

let initialized = false

/** Loads the config once and subscribes to main-process pushed updates. Safe to call from multiple components; only wires up once. */
export function initConfigStore(): void {
  if (initialized) return
  initialized = true
  window.control.config.get().then((config) => useConfigStore.getState().setConfig(config))
  window.control.config.onChanged((config) => useConfigStore.getState().setConfig(config))
}
