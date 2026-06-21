import type { AppViewMode } from '@folio/shared-types'
import { create } from 'zustand'

export type AppView = AppViewMode

/** Chrome layout toggles that aren't tied to the queue or viewer state. */
interface UiState {
  activeView: AppView
  /** When true, the queue (image list) side rail is hidden to give the canvas more room. */
  queueCollapsed: boolean
  /** Whether the window is fullscreen — drives the immersive viewer layout. */
  fullscreen: boolean
  showViewer: () => void
  showSettings: () => void
  showBatchTasks: () => void
  toggleQueue: () => void
  /** Seed the rail's collapsed state from the persisted startup preference (boot only). */
  setQueueCollapsed: (collapsed: boolean) => void
  setFullscreen: (fullscreen: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeView: 'viewer',
  // Collapsed by default; boot overrides this from settings.startSidebarCollapsed (main.tsx).
  queueCollapsed: true,
  fullscreen: false,
  showViewer: () => set({ activeView: 'viewer' }),
  showSettings: () => set({ activeView: 'settings' }),
  showBatchTasks: () => set({ activeView: 'batch_tasks' }),
  toggleQueue: () => set((s) => ({ queueCollapsed: !s.queueCollapsed })),
  setQueueCollapsed: (queueCollapsed) => set({ queueCollapsed }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
}))
