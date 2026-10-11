import type { CSSProperties } from 'react'

/**
 * Computes the derived accent shades as plain rgb()/rgba() strings in JS,
 * rather than via CSS `color-mix()` on `:root` — confirmed live that
 * Lightning CSS (Tailwind v4's processor) rewrites `color-mix()` into a
 * plain fallback declaration plus an `@supports`-gated override, both only
 * declared on `:root`. Overriding just `--accent` on a descendant element
 * doesn't make those derived `:root`-only custom properties re-resolve
 * against the override the way a naive reading of the CSS cascade would
 * suggest — the whole control app's accent color silently failed to
 * actually change color when tested this way. Computing every shade
 * up front in JS and setting all of them as inline custom properties
 * sidesteps the whole class of cascade/fallback-splitting issues.
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean
  const value = Number.parseInt(full, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function mixWithWhite(rgb: [number, number, number], amount: number): [number, number, number] {
  return rgb.map((c) => Math.round(c * (1 - amount) + 255 * amount)) as [number, number, number]
}

export function computeAccentVars(hex: string): CSSProperties {
  let rgb: [number, number, number]
  try {
    rgb = hexToRgb(hex)
  } catch {
    rgb = [217, 70, 239] // fall back to the original default accent on a malformed value
  }
  const light = mixWithWhite(rgb, 0.55)

  return {
    '--accent': `rgb(${rgb.join(',')})`,
    '--accent-light': `rgb(${light.join(',')})`,
    '--accent-border': `rgba(${light.join(',')},0.6)`,
    '--accent-border-soft': `rgba(${light.join(',')},0.4)`,
    '--accent-bg': `rgba(${rgb.join(',')},0.1)`,
    '--accent-bg-strong': `rgba(${rgb.join(',')},0.2)`
  } as CSSProperties
}
