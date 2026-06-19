// Core domain types — mirrors docs/prd.md. Shared by main, preload and renderer.

export type MetadataStatus = 'pending' | 'loaded' | 'failed'

/**
 * Canonical image formats Folio recognises, identified from a file's magic bytes
 * (content) rather than its extension. `jpg`→`jpeg`, `tif`→`tiff` are normalised away.
 */
export type ImageFormat =
  | 'jpeg'
  | 'png'
  | 'gif'
  | 'webp'
  | 'bmp'
  | 'tiff'
  | 'avif'
  | 'heic'
  | 'heif'
  | 'jxl'

/** A single item in the browse queue. Holds path + index metadata only — never raw image bytes. */
export interface ImageQueueItem {
  id: string
  filePath: string
  fileName: string
  /** Lower-cased extension from the file name (no dot). May lie about the real content. */
  ext: string
  /** True format sniffed from magic bytes; undefined when the header matched nothing or was unreadable. */
  format?: ImageFormat
  size: number
  width?: number
  height?: number
  modifiedAt: number
  createdAt?: number
  thumbnailPath?: string
  metadataStatus: MetadataStatus
}

export type SortMode =
  | 'name_asc'
  | 'name_desc'
  | 'modified_asc'
  | 'modified_desc'
  | 'created_asc'
  | 'created_desc'
  | 'size_asc'
  | 'size_desc'
  | 'format_asc'

export interface QueueState {
  directory?: string
  items: ImageQueueItem[]
  currentIndex: number
  sortMode: SortMode
  /** Bumped on every queue mutation; workers must validate against it before applying stale results. */
  version: number
}

export type FitMode = 'fit_window' | 'original_size' | 'custom'
export type Rotation = 0 | 90 | 180 | 270

export interface ViewerState {
  currentItemId?: string
  zoom: number
  fitMode: FitMode
  rotation: Rotation
}

export type AppViewMode = 'viewer' | 'batch_tasks' | 'settings'

// ---- Multi-view ----

export type MultiViewMode = 'single' | 'dual' | 'triple' | 'quad'

export type MultiViewLayout =
  | 'single'
  | 'dual_horizontal'
  | 'dual_vertical'
  | 'triple_main_left'
  | 'triple_equal_columns'
  | 'quad_grid'

export type FocusedSlot = 0 | 1 | 2 | 3

export interface MultiViewState {
  mode: MultiViewMode
  layout: MultiViewLayout
  startIndex: number
  focusedSlot: FocusedSlot
  syncZoom: boolean
  loopEnabled: boolean
  fillBlankSlots: boolean
  groupItemIds: string[]
  zoomByItemId: Record<string, number>
  panByItemId: Record<string, { x: number; y: number }>
}

// ---- Tasks ----

export type TaskType =
  | 'metadata_read'
  | 'metadata_remove'
  | 'rename'
  | 'convert'
  | 'hash'
  | 'thumbnail'
  | 'preview'

export type TaskStatus = 'pending' | 'running' | 'paused' | 'success' | 'failed' | 'cancelled'

export interface TaskLog {
  at: number
  level: 'info' | 'warn' | 'error'
  message: string
  filePath?: string
}

export interface Task {
  id: string
  type: TaskType
  status: TaskStatus
  total: number
  completed: number
  failed: number
  createdAt: number
  updatedAt: number
  logs: TaskLog[]
}
