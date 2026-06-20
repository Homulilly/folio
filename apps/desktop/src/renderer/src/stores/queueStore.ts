import { sortItems } from '@folio/core'
import type { ImageQueueItem, ScanResult, SortMode } from '@folio/shared-types'
import { create } from 'zustand'

interface QueueState {
  directory?: string
  items: ImageQueueItem[]
  currentIndex: number
  sortMode: SortMode
  /** Bumped on every mutation; lets later workers discard stale results (PRD §9.3). */
  version: number

  /**
   * Replace the queue from a scan. With `keepFocus`, the currently focused image is re-selected
   * by path if it survived (used by refresh); otherwise the scan's own `currentIndex` is honoured.
   */
  loadResult: (result: ScanResult, opts?: { keepFocus?: boolean }) => void
  setSortMode: (mode: SortMode) => void
  /** Seed the persisted sort order on boot (before any folder is loaded). */
  hydrateSortMode: (mode: SortMode) => void
  select: (index: number) => void
  next: () => void
  prev: () => void
  first: () => void
  last: () => void
  random: () => void
  /** Remove the current item (e.g. after trashing) and keep the selection sensible. */
  removeCurrent: () => void
  removeItem: (id: string) => void
}

/** Re-sort while keeping the same item focused by file path. */
function resort(items: ImageQueueItem[], focusIndex: number, mode: SortMode) {
  const focusPath = items[focusIndex]?.filePath
  const sorted = sortItems(items, mode)
  const idx = focusPath ? sorted.findIndex((it) => it.filePath === focusPath) : 0
  return { sorted, idx: idx >= 0 ? idx : 0 }
}

export const useQueueStore = create<QueueState>((set) => ({
  items: [],
  currentIndex: 0,
  sortMode: 'name_asc',
  version: 0,

  loadResult: (result, opts) =>
    set((s) => {
      // Refresh keeps the user on the same image (by path); a fresh open uses the scan's focus.
      const keepPath = opts?.keepFocus ? s.items[s.currentIndex]?.filePath : undefined
      const sorted = sortItems(result.items, s.sortMode)
      let idx = keepPath ? sorted.findIndex((it) => it.filePath === keepPath) : -1
      if (idx < 0) {
        const targetPath = result.items[result.currentIndex]?.filePath
        idx = targetPath ? sorted.findIndex((it) => it.filePath === targetPath) : 0
      }
      return {
        directory: result.directory,
        items: sorted,
        currentIndex: idx >= 0 ? idx : 0,
        version: s.version + 1,
      }
    }),

  setSortMode: (mode) => {
    void window.gv.settings.update({ sortMode: mode })
    set((s) => {
      const { sorted, idx } = resort(s.items, s.currentIndex, mode)
      return { sortMode: mode, items: sorted, currentIndex: idx, version: s.version + 1 }
    })
  },

  hydrateSortMode: (mode) => set({ sortMode: mode }),

  select: (index) =>
    set((s) => ({ currentIndex: Math.max(0, Math.min(s.items.length - 1, index)) })),

  next: () => set((s) => ({ currentIndex: Math.min(s.items.length - 1, s.currentIndex + 1) })),
  prev: () => set((s) => ({ currentIndex: Math.max(0, s.currentIndex - 1) })),
  first: () => set({ currentIndex: 0 }),
  last: () => set((s) => ({ currentIndex: Math.max(0, s.items.length - 1) })),
  random: () =>
    set((s) => {
      if (s.items.length <= 1) return {}
      let idx = s.currentIndex
      while (idx === s.currentIndex) idx = Math.floor(Math.random() * s.items.length)
      return { currentIndex: idx }
    }),

  removeCurrent: () =>
    set((s) => {
      if (s.items.length === 0) return {}
      const items = s.items.filter((_, i) => i !== s.currentIndex)
      const currentIndex = Math.max(0, Math.min(items.length - 1, s.currentIndex))
      return { items, currentIndex, version: s.version + 1 }
    }),

  removeItem: (id) =>
    set((s) => {
      const removeIndex = s.items.findIndex((it) => it.id === id)
      if (removeIndex < 0) return {}
      const items = s.items.filter((it) => it.id !== id)
      let currentIndex = s.currentIndex
      if (removeIndex < currentIndex) currentIndex -= 1
      else if (currentIndex >= items.length) currentIndex = Math.max(0, items.length - 1)
      return { items, currentIndex, version: s.version + 1 }
    }),
}))
