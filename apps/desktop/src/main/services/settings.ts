import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SETTINGS } from '@folio/config'
import type { AppLanguage, AppSettings } from '@folio/shared-types'
import { app } from 'electron'

// settings.json persistence (PRD §10.1). Synchronous reads/writes — the file is tiny and touched
// rarely, so a sync API keeps callers simple (the cache eviction budget and several IPC handlers
// read it). Loaded settings are merged over DEFAULT_SETTINGS so a file written by an older version
// (missing newly-added keys) still yields a complete object.

let cached: AppSettings | null = null

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** System language, used as the first-run default before the user has chosen one. */
function systemLanguage(): AppLanguage {
  return app.getLocale().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

/** Defaults for a brand-new install — like DEFAULT_SETTINGS but language follows the OS locale. */
function freshDefaults(): AppSettings {
  return { ...DEFAULT_SETTINGS, language: systemLanguage() }
}

/** Merge persisted values over defaults (one level deep for the nested multiView object). */
function merge(stored: Partial<AppSettings>): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    multiView: { ...DEFAULT_SETTINGS.multiView, ...stored.multiView },
  }
}

/** Read settings (cached). Falls back to defaults if the file is absent or corrupt. */
export function getSettings(): AppSettings {
  if (cached) return cached
  try {
    cached = merge(JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<AppSettings>)
  } catch {
    // No file yet (or corrupt) — start from defaults with the OS language; not persisted until a
    // setting is actually changed, so every cold start re-detects the locale consistently.
    cached = freshDefaults()
  }
  return cached
}

/** Atomically persist `settings` (write to a temp file, then rename) so a crash can't truncate it. */
function persist(settings: AppSettings): void {
  const path = settingsPath()
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8')
  renameSync(tmp, path)
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = merge({ ...getSettings(), ...patch })
  cached = next
  persist(next)
  return next
}

export function resetSettings(): AppSettings {
  cached = freshDefaults()
  persist(cached)
  return cached
}
