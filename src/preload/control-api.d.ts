import type { ControlApi } from './control'

declare global {
  interface Window {
    control: ControlApi
  }
}
