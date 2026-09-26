import type { ColorProfile } from './types'

export const GAMMA_FILTER_ID = 'minidisplay-gamma'

/**
 * Builds the CSS `filter` value for a color profile. Brightness/contrast/
 * saturation/hue all have native CSS filter functions; gamma doesn't, so a
 * neutral gamma (1) is simply omitted and a non-neutral one references an
 * SVG <filter> (feComponentTransfer type="gamma") that must be rendered
 * elsewhere in the same document with the id `GAMMA_FILTER_ID`.
 */
export function buildColorFilterCss(profile: ColorProfile): string {
  const parts = [
    `brightness(${profile.brightness})`,
    `contrast(${profile.contrast})`,
    `saturate(${profile.saturation})`,
    `hue-rotate(${profile.hue}deg)`
  ]
  if (profile.gamma !== 1) {
    parts.push(`url(#${GAMMA_FILTER_ID})`)
  }
  return parts.join(' ')
}

/** feFuncR/G/B exponent for the gamma SVG filter: displayed = input ^ (1/gamma), so gamma > 1 brightens midtones. */
export function gammaExponent(profile: ColorProfile): number {
  return 1 / profile.gamma
}
