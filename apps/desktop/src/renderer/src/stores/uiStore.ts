import { create } from 'zustand'

/** Chrome layout toggles that aren't tied to the queue or viewer state. */
interface UiState {
  /** When true, the queue (image list) side rail is hidden to give the canvas more room. */
  queueCollapsed: boolean
  toggleQueue: () => void
}

export const useUiStore = create<UiState>((set) => ({
  queueCollapsed: false,
  toggleQueue: () => set((s) => ({ queueCollapsed: !s.queueCollapsed })),
}))
