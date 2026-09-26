import type { ReactElement } from 'react'

export function ComingSoonPage({ title, phase }: { title: string; phase: string }): ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-white/40">
      <div className="text-lg font-medium text-white/70">{title}</div>
      <div className="text-sm">Arrives in {phase}</div>
    </div>
  )
}
