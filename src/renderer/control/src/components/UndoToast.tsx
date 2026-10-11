import { useEffect, type ReactElement } from 'react'
import { Undo2 } from 'lucide-react'
import { useUndoStore } from '../store/useUndoStore'

const AUTO_DISMISS_MS = 6000

export function UndoToast(): ReactElement | null {
  const pending = useUndoStore((s) => s.pending)
  const clear = useUndoStore((s) => s.clear)

  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(clear, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [pending, clear])

  if (!pending) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-[var(--border-2)] bg-[var(--surface-popover)] px-4 py-2.5 text-sm text-[var(--text-1)] shadow-lg">
        <span>{pending.label}</span>
        <button
          onClick={() => {
            pending.restore()
            clear()
          }}
          className="flex items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-bg)] px-2.5 py-1 text-xs text-[var(--accent-light)] hover:border-[var(--accent-border)]"
        >
          <Undo2 size={12} />
          Undo
        </button>
      </div>
    </div>
  )
}
