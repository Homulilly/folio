import { create } from 'zustand'

export type AppView = 'viewer' | 'settings'

/** Chrome layout toggles that aren't tied to the queue or viewer state. */
interface UiState {
  activeView: AppView
  /** When true, the queue (image list) side rail is hidden to give the canvas more room. */
  queueCollapsed: boolean
  showViewer: () => void
  showSettings: () => void
  toggleQueue: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activeView: 'viewer',
  queueCollapsed: false,
  showViewer: () => set({ activeView: 'viewer' }),
  showSettings: () => set({ activeView: 'settings' }),
  toggleQueue: () => set((s) => ({ queueCollapsed: !s.queueCollapsed })),
}))
