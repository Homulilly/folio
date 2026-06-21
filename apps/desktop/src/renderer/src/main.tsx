import type { QuickSaveRule } from '@folio/shared-types'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
import { useEraseStore } from './stores/eraseStore'
import { useMultiViewStore } from './stores/multiViewStore'
import { useQueueStore } from './stores/queueStore'
import { useSaveStore } from './stores/saveStore'
import { type AppLanguage, useSettingsStore } from './stores/settingsStore'
import { useUiStore } from './stores/uiStore'

const LEGACY_LANGUAGE_KEY = 'folio.settings.language'

function isLanguage(value: string | null): value is AppLanguage {
  return value === 'zh-CN' || value === 'en'
}

/** Migrate the pre-multi-target quick-save shape ({ targetDir }) to { targetDirs: [...] }. */
function normalizeQuickRule(rule: QuickSaveRule | null): QuickSaveRule | null {
  if (!rule) return null
  const legacy = rule as QuickSaveRule & { targetDir?: string }
  if (Array.isArray(legacy.targetDirs)) return rule
  return {
    targetDirs: legacy.targetDir ? [legacy.targetDir] : [],
    naming: rule.naming,
    conflict: rule.conflict,
  }
}

/**
 * Read persisted settings before the first paint (PRD §10.1 / M7), so the UI renders in the saved
 * language rather than flashing the system default. One-time migration: an older build stored the
 * language in renderer localStorage — if that key is present, fold it into settings.json and drop it.
 * Any failure falls back to in-memory defaults (system language) so a settings read can't block viewing.
 */
async function hydrateFromSettings(): Promise<void> {
  try {
    const settings = await window.gv.settings.get()
    let language = settings.language

    try {
      const legacy = window.localStorage.getItem(LEGACY_LANGUAGE_KEY)
      if (isLanguage(legacy)) {
        language = legacy
        await window.gv.settings.update({ language: legacy })
        window.localStorage.removeItem(LEGACY_LANGUAGE_KEY)
      }
    } catch {
      /* localStorage unavailable — nothing to migrate. */
    }

    useSettingsStore.getState().hydrate({ ...settings, language })
    useUiStore.getState().setQueueCollapsed(settings.startSidebarCollapsed)
    useSaveStore.getState().hydrateQuickRule(normalizeQuickRule(settings.quickSaveRule))
    useQueueStore.getState().hydrateSortMode(settings.sortMode)
    useEraseStore.getState().hydrateDefault(settings.defaultErase)
    useMultiViewStore.getState().hydrate({
      mode: settings.defaultMultiViewMode,
      loopEnabled: settings.multiView.loopEnabled,
      syncZoom: settings.multiView.syncZoom,
    })
  } catch {
    /* Keep the in-memory defaults; viewing must not depend on settings being readable. */
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

void hydrateFromSettings().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
