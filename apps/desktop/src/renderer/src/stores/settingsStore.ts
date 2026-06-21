import type { AppLanguage } from '@folio/config'
import type { AppSettings } from '@folio/shared-types'
import { create } from 'zustand'

export type { AppLanguage } from '@folio/config'

function systemLanguage(): AppLanguage {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

// Renderer mirror of the "pure" settings that have no operational store of their own (browsing
// prefs like sort/mode/loop live in queueStore/multiViewStore and persist from there). Hydrated
// from settings.json on boot (main.tsx); each setter writes back via the settings IPC.
interface SettingsState {
  language: AppLanguage
  confirmDeleteToTrash: boolean
  thumbnailCacheSizeMB: number
  previewCacheSizeMB: number
  /** Whether the queue side rail starts collapsed on launch (startup preference). */
  startSidebarCollapsed: boolean
  /** Seed from persisted settings on boot. */
  hydrate: (settings: AppSettings) => void
  setLanguage: (language: AppLanguage) => void
  setConfirmDeleteToTrash: (confirm: boolean) => void
  setCacheSizeMB: (which: 'thumbnail' | 'preview', mb: number) => void
  setStartSidebarCollapsed: (collapsed: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: systemLanguage(),
  confirmDeleteToTrash: true,
  thumbnailCacheSizeMB: 1024,
  previewCacheSizeMB: 2048,
  startSidebarCollapsed: true,
  hydrate: (s) =>
    set({
      language: s.language,
      confirmDeleteToTrash: s.confirmDeleteToTrash,
      thumbnailCacheSizeMB: s.thumbnailCacheSizeMB,
      previewCacheSizeMB: s.previewCacheSizeMB,
      startSidebarCollapsed: s.startSidebarCollapsed,
    }),
  setLanguage: (language) => {
    set({ language })
    void window.gv.settings.update({ language })
  },
  setConfirmDeleteToTrash: (confirmDeleteToTrash) => {
    set({ confirmDeleteToTrash })
    void window.gv.settings.update({ confirmDeleteToTrash })
  },
  setCacheSizeMB: (which, mb) => {
    if (which === 'thumbnail') {
      set({ thumbnailCacheSizeMB: mb })
      void window.gv.settings.update({ thumbnailCacheSizeMB: mb })
    } else {
      set({ previewCacheSizeMB: mb })
      void window.gv.settings.update({ previewCacheSizeMB: mb })
    }
  },
  setStartSidebarCollapsed: (startSidebarCollapsed) => {
    set({ startSidebarCollapsed })
    void window.gv.settings.update({ startSidebarCollapsed })
  },
}))
