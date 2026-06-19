import type { MultiViewLayout, MultiViewMode, SortMode } from '@galleryviewer/shared-types'

/** User settings persisted to settings.json (PRD §10.1). */
export interface AppSettings {
  defaultOpenDirectory: string
  defaultSaveDirectory: string
  sortMode: SortMode
  defaultMultiViewMode: MultiViewMode
  multiView: {
    loopEnabled: boolean
    syncZoom: boolean
    tripleLayout: Extract<MultiViewLayout, 'triple_main_left' | 'triple_equal_columns'>
    dualLayout: Extract<MultiViewLayout, 'dual_horizontal' | 'dual_vertical'>
  }
  /** Never overwrite the original when erasing/converting/saving (PRD §13). */
  alwaysExportNewFile: boolean
  confirmDeleteToTrash: boolean
  thumbnailCacheSizeMB: number
  previewCacheSizeMB: number
}

export const DEFAULT_SETTINGS: AppSettings = {
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
}
