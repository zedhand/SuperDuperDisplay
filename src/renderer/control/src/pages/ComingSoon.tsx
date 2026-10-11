import type { ReactElement } from 'react'

export function ComingSoonPage({ title, phase }: { title: string; phase: string }): ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--text-5)]">
      <div className="text-lg font-medium text-[var(--text-3)]">{title}</div>
      <div className="text-sm">Arrives in {phase}</div>
    </div>
  )
}
