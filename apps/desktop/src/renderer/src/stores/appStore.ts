import type { AppViewMode } from '@galleryviewer/shared-types'
import { create } from 'zustand'

interface AppState {
  view: AppViewMode
  setView: (view: AppViewMode) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'viewer',
  setView: (view) => set({ view }),
}))
