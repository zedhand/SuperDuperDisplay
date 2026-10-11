import { create } from 'zustand'

interface PendingUndo {
  label: string
  restore: () => void
}

interface UndoStore {
  pending: PendingUndo | null
  offer: (label: string, restore: () => void) => void
  clear: () => void
}

/**
 * A single-slot "last destructive action" undo offer, shown as a toast.
 * Only one pending undo exists at a time — offering a new one (e.g.
 * deleting a second layer before undoing the first) replaces it, since
 * there's no meaningful way to stack more than one out-of-order restore
 * with this simple a model.
 */
export const useUndoStore = create<UndoStore>((set) => ({
  pending: null,
  offer: (label, restore) => set({ pending: { label, restore } }),
  clear: () => set({ pending: null })
}))
