import { describe, expect, it } from 'vitest'
import { buildColorFilterCss, gammaExponent } from '../src/shared/colorProfile'
import type { ColorProfile } from '../src/shared/types'

const neutral: ColorProfile = {
  id: 'neutral',
  name: 'Neutral',
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  gamma: 1
}

describe('buildColorFilterCss', () => {
  it('includes brightness, contrast, saturate, and hue-rotate in that order', () => {
    const css = buildColorFilterCss({
      ...neutral,
      brightness: 1.2,
      contrast: 0.9,
      saturation: 1.5,
      hue: 30
    })
    expect(css).toBe('brightness(1.2) contrast(0.9) saturate(1.5) hue-rotate(30deg)')
  })

  it('omits the gamma url() when gamma is neutral (1)', () => {
    expect(buildColorFilterCss(neutral)).not.toContain('url(')
  })

  it('appends a url() reference to the shared gamma filter id when gamma is not neutral', () => {
    const css = buildColorFilterCss({ ...neutral, gamma: 1.8 })
    expect(css).toContain('url(#minidisplay-gamma)')
  })
})

describe('gammaExponent', () => {
  it('is the reciprocal of the profile gamma', () => {
    expect(gammaExponent({ ...neutral, gamma: 2 })).toBe(0.5)
    expect(gammaExponent({ ...neutral, gamma: 1 })).toBe(1)
  })
})
