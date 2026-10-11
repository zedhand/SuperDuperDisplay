import type { ReactElement } from 'react'
import type { ColorProfile } from '@shared/types'
import { useConfigStore } from '../store/useConfigStore'

const SLIDERS: Array<{
  key: keyof Pick<ColorProfile, 'brightness' | 'contrast' | 'saturation' | 'hue' | 'gamma'>
  label: string
  min: number
  max: number
  step: number
}> = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 2, step: 0.01 },
  { key: 'contrast', label: 'Contrast', min: 0, max: 2, step: 0.01 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.01 },
  { key: 'hue', label: 'Hue shift', min: -180, max: 180, step: 1 },
  { key: 'gamma', label: 'Gamma', min: 0.1, max: 3, step: 0.01 }
]

const NEUTRAL: Pick<ColorProfile, 'brightness' | 'contrast' | 'saturation' | 'hue' | 'gamma'> = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  gamma: 1
}

export function ColorPage(): ReactElement {
  const config = useConfigStore((s) => s.config)
  const patch = useConfigStore((s) => s.patch)

  if (!config) return <div className="p-6 text-[var(--text-4)]">Loading…</div>

  const activePreset = config.presets.find((p) => p.id === config.activePresetId)
  const profile =
    activePreset && config.colorProfiles.find((c) => c.id === activePreset.colorProfileId)

  if (!activePreset || !profile) {
    return <div className="p-6 text-[var(--text-4)]">No active scene.</div>
  }

  function updateProfile(patchValues: Partial<ColorProfile>): void {
    if (!config || !profile) return
    patch({
      colorProfiles: config.colorProfiles.map((c) =>
        c.id === profile.id ? { ...c, ...patchValues } : c
      )
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <section>
        <h2 className="mb-1 text-lg font-semibold text-[var(--text-1)]">
          Color for {activePreset.name}
        </h2>
        <p className="mb-4 text-xs text-[var(--text-5)]">
          Adjusts &quot;{profile.name}&quot;, applied to the whole panel — use this to color-match
          the output to your case&apos;s RGB lighting.
        </p>

        <div className="flex max-w-md flex-col gap-4">
          {SLIDERS.map(({ key, label, min, max, step }) => (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm text-[var(--text-2)]">
                <span>{label}</span>
                <span className="text-[var(--text-4)]">{profile[key]}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={profile[key]}
                onChange={(e) => updateProfile({ [key]: Number(e.target.value) })}
                className="accent-[var(--accent)]"
              />
            </div>
          ))}
        </div>

        <button
          onClick={() => updateProfile(NEUTRAL)}
          className="mt-4 w-fit rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-2 text-sm text-[var(--text-3)] hover:border-[var(--border-2)]"
        >
          Reset to neutral
        </button>
      </section>
    </div>
  )
}
