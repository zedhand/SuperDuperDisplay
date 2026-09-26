import type { DisplayApi } from './display'

declare global {
  interface Window {
    display: DisplayApi
  }
}
