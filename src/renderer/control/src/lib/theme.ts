import type { CSSProperties } from 'react'

/**
 * Semantic surface/text/border tokens for the control app's own chrome —
 * every page's Tailwind classes reference these via arbitrary-value syntax
 * (e.g. `bg-[var(--surface-1)]`) instead of a hardcoded `bg-white/5`, so
 * switching themes recolors the whole app at once. Computed in JS as plain
 * rgba()/hex strings and set as inline custom properties on the app root,
 * the same approach `computeAccentVars()` already established — not CSS
 * `color-mix()`, which Tailwind v4's processor rewrites into a plain-value
 * fallback plus an `@supports`-gated override that don't correctly
 * re-resolve against an override further down the tree (see accent.ts's
 * doc comment for the full story).
 *
 * `bg-black` on the Layers-canvas/Layout-page split preview and `bg-white`
 * on the Remote page's QR code are deliberately left as plain Tailwind
 * classes, not tokens here — they represent the physical panel's own
 * always-black background and a QR code's functional white background
 * respectively, neither of which should follow the control app's own
 * chrome theme.
 */
export function computeThemeVars(theme: 'dark' | 'light'): CSSProperties {
  if (theme === 'light') {
    return {
      colorScheme: 'light',
      '--bg-app': '#f2f2f5',
      '--surface-0': 'rgba(0,0,0,0.02)',
      '--surface-1': 'rgba(0,0,0,0.04)',
      '--surface-2': 'rgba(0,0,0,0.07)',
      '--surface-3': 'rgba(0,0,0,0.12)',
      '--surface-sidebar': 'rgba(0,0,0,0.04)',
      '--surface-popover': '#ffffff',
      '--border-1': 'rgba(0,0,0,0.10)',
      '--border-2': 'rgba(0,0,0,0.22)',
      '--text-1': '#16161a',
      '--text-2': 'rgba(22,22,26,0.8)',
      '--text-3': 'rgba(22,22,26,0.7)',
      '--text-4': 'rgba(22,22,26,0.5)',
      '--text-5': 'rgba(22,22,26,0.4)',
      '--text-6': 'rgba(22,22,26,0.3)'
    } as CSSProperties
  }
  return {
    colorScheme: 'dark',
    '--bg-app': '#0b0b0f',
    '--surface-0': 'rgba(255,255,255,0.02)',
    '--surface-1': 'rgba(255,255,255,0.05)',
    '--surface-2': 'rgba(255,255,255,0.10)',
    '--surface-3': 'rgba(255,255,255,0.20)',
    '--surface-sidebar': 'rgba(0,0,0,0.30)',
    '--surface-popover': '#15151b',
    '--border-1': 'rgba(255,255,255,0.10)',
    '--border-2': 'rgba(255,255,255,0.20)',
    '--text-1': '#ffffff',
    '--text-2': 'rgba(255,255,255,0.8)',
    '--text-3': 'rgba(255,255,255,0.7)',
    '--text-4': 'rgba(255,255,255,0.5)',
    '--text-5': 'rgba(255,255,255,0.4)',
    '--text-6': 'rgba(255,255,255,0.3)'
  } as CSSProperties
}
