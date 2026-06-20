import type { AppViewMode } from '@folio/shared-types'
import { create } from 'zustand'

export type AppView = AppViewMode

/** Chrome layout toggles that aren't tied to the queue or viewer state. */
interface UiState {
  activeView: AppView
  /** When true, the queue (image list) side rail is hidden to give the canvas more room. */
  queueCollapsed: boolean
  showViewer: () => void
  showSettings: () => void
  showBatchTasks: () => void
  toggleQueue: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activeView: 'viewer',
  queueCollapsed: false,
  showViewer: () => set({ activeView: 'viewer' }),
  showSettings: () => set({ activeView: 'settings' }),
  showBatchTasks: () => set({ activeView: 'batch_tasks' }),
  toggleQueue: () => set((s) => ({ queueCollapsed: !s.queueCollapsed })),
}))
