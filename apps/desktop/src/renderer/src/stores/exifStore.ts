import { create } from 'zustand'

export type ExifTab = 'summary' | 'grouped' | 'raw'

/** Exif drawer UI state: visibility, active view, and the field-search query. */
interface ExifState {
  open: boolean
  tab: ExifTab
  search: string
  /** Bumped to force the drawer to re-read metadata (e.g. after an in-place erase). */
  refreshToken: number
  toggle: () => void
  close: () => void
  setTab: (tab: ExifTab) => void
  setSearch: (search: string) => void
  refresh: () => void
}

export const useExifStore = create<ExifState>((set) => ({
  open: false,
  tab: 'summary',
  search: '',
  refreshToken: 0,
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
  setTab: (tab) => set({ tab }),
  setSearch: (search) => set({ search }),
  refresh: () => set((s) => ({ refreshToken: s.refreshToken + 1 })),
}))
