import type { ReactElement } from 'react'
import {
  Clapperboard,
  LayoutGrid,
  Monitor,
  Palette,
  Radio,
  Settings,
  Thermometer
} from 'lucide-react'

export const PAGES = [
  { id: 'displays', label: 'Displays', icon: Monitor },
  { id: 'scenes', label: 'Scenes', icon: Clapperboard },
  { id: 'layout', label: 'Layout', icon: LayoutGrid },
  { id: 'color', label: 'Color', icon: Palette },
  { id: 'triggers', label: 'Triggers', icon: Thermometer },
  { id: 'remote', label: 'Remote', icon: Radio },
  { id: 'settings', label: 'Settings', icon: Settings }
] as const

export type PageId = (typeof PAGES)[number]['id']

export function Sidebar({
  active,
  onSelect
}: {
  active: PageId
  onSelect: (id: PageId) => void
}): ReactElement {
  return (
    <nav className="flex w-56 flex-col gap-1 border-r border-[var(--border-1)] bg-[var(--surface-sidebar)] p-3">
      <div className="mb-4 px-2 text-sm font-semibold tracking-wide text-[var(--text-3)]">
        SuperDuperDisplay
      </div>
      {PAGES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
            active === id
              ? 'bg-[var(--accent-bg-strong)] text-[var(--accent-light)]'
              : 'text-[var(--text-3)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]'
          }`}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </nav>
  )
}
