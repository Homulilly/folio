import type { AppSettings } from '@folio/shared-types'

// AppSettings / AppLanguage now live in @folio/shared-types (they're part of the settings IPC
// contract). This package owns the default values and re-exports the types for convenience.
export type { AppLanguage, AppSettings } from '@folio/shared-types'

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  defaultOpenDirectory: '',
  defaultSaveDirectory: '',
  sortMode: 'name_asc',
  defaultMultiViewMode: 'single',
  multiView: {
    loopEnabled: false,
    syncZoom: false,
    tripleLayout: 'triple_main_left',
    dualLayout: 'dual_horizontal',
  },
  alwaysExportNewFile: true,
  confirmDeleteToTrash: true,
  thumbnailCacheSizeMB: 1024,
  previewCacheSizeMB: 2048,
  quickSaveRule: null,
}
