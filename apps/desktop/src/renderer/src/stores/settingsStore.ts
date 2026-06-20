import type { AppLanguage } from '@folio/config'
import { create } from 'zustand'

export type { AppLanguage } from '@folio/config'

function systemLanguage(): AppLanguage {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

interface SettingsState {
  language: AppLanguage
  /** Seed the language from persisted settings on boot (see main.tsx). */
  hydrate: (language: AppLanguage) => void
  setLanguage: (language: AppLanguage) => void
}

// Persistence moved to settings.json (M7): the language is hydrated from main on boot (main.tsx)
// and every change is written back via the settings IPC. Until hydration runs the store shows the
// system language so the very first paint isn't wrong if hydration is slow.
export const useSettingsStore = create<SettingsState>((set) => ({
  language: systemLanguage(),
  hydrate: (language) => set({ language }),
  setLanguage: (language) => {
    set({ language })
    void window.gv.settings.update({ language })
  },
}))
