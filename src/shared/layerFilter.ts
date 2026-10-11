import type { LayerFilter } from './types'

/** CSS `filter` value for a layer, shared between the display's `LayersZone` and the control app's canvas-editor preview so both render identically. */
export function layerFilterCss(filter: LayerFilter): string | undefined {
  switch (filter) {
    case 'grayscale':
      return 'grayscale(1)'
    case 'sepia':
      return 'sepia(0.8)'
    case 'blur':
      return 'blur(6px)'
    case 'invert':
      return 'invert(1)'
    default:
      return undefined
  }
}
