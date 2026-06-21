import type { MultiViewLayout, MultiViewMode, SortMode } from './domain'
import type { DefaultEraseRule } from './erase'
import type { QuickSaveRule } from './save'

export type AppLanguage = 'zh-CN' | 'en'

/**
 * User settings persisted to settings.json (PRD §10.1). Lives here (not in @folio/config) because
 * it is part of the IPC contract (settings.get/update/reset); @folio/config re-exports it and owns
 * DEFAULT_SETTINGS.
 */
export interface AppSettings {
  language: AppLanguage
  defaultOpenDirectory: string
  defaultSaveDirectory: string
  sortMode: SortMode
  /** Whether the queue side rail starts collapsed on launch (the live toggle is session-only). */
  startSidebarCollapsed: boolean
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
  /** Remembered quick-save rule (PRD §6.7); null until the user first saves with one. */
  quickSaveRule: QuickSaveRule | null
  /** Remembered erase configuration (PRD §6.6 「存为默认规则」); null = the built-in Privacy default. */
  defaultErase: DefaultEraseRule | null
}

/**
 * A partial settings update. Top-level keys are optional, and the nested `multiView` may itself be
 * partial (e.g. toggling just `loopEnabled`) — the main process deep-merges it over current values.
 */
export type SettingsPatch = Partial<Omit<AppSettings, 'multiView'>> & {
  multiView?: Partial<AppSettings['multiView']>
}
