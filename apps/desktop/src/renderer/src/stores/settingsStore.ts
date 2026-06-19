import type { AppLanguage } from '@folio/config'
import { create } from 'zustand'

export type { AppLanguage } from '@folio/config'

const LANGUAGE_STORAGE_KEY = 'folio.settings.language'

function isLanguage(value: string | null): value is AppLanguage {
  return value === 'zh-CN' || value === 'en'
}

function systemLanguage(): AppLanguage {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

function initialLanguage(): AppLanguage {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    /* localStorage can be unavailable in restricted browser contexts. */
  }
  return systemLanguage()
}

interface SettingsState {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: initialLanguage(),
  setLanguage: (language) => {
    set({ language })
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      /* Ignore persistence failures; the in-memory setting still applies. */
    }
  },
}))
