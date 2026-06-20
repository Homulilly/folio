// IPC contract between renderer (via preload contextBridge) and main process.
// Namespaces follow PRD §9.2: image.* / file.* / recent.* / win.* (+ system.*).

import type { ConvertRequest, ConvertResult } from './convert'
import type { ImageQueueItem, Task } from './domain'
import type { BatchEraseRequest, EraseResult, EraseRule, EraseTarget } from './erase'
import type { DirListing } from './fs'
import type { ExifMetadata } from './metadata'
import type { RenameExecRequest, RenameResult } from './rename'
import type { SaveRequest, SaveResult } from './save'
import type { AppSettings } from './settings'

/** Custom privileged protocol used to stream images to the renderer (never base64 over IPC). */
export const GV_IMG_SCHEME = 'gv-img'

export interface SystemInfo {
  appVersion: string
  electronVersion: string
  chromeVersion: string
  nodeVersion: string
  platform: string
  arch: string
}

/** Result of opening a file/folder/drop — a freshly scanned queue. */
export interface ScanResult {
  /** Containing directory when known (single file or folder); absent for an ad-hoc multi-file drop. */
  directory?: string
  items: ImageQueueItem[]
  /** Index (into `items`, in scan order) that should be focused initially. */
  currentIndex: number
}

export type TrashResult = 'trashed' | 'failed'

/**
 * Why an image failed to load — diagnosed after `<img>` fires onError (which carries no reason).
 * `decodable` means the file is present and readable, so the failure is a decode/format problem.
 */
export type FileProbe = 'missing' | 'unreadable' | 'decodable'

/**
 * The full surface exposed on `window.gv` by the preload bridge.
 * Async methods are backed by ipcRenderer.invoke. Renderer has zero direct fs access.
 */
export interface FolioApi {
  system: {
    ping: () => Promise<'pong'>
    getInfo: () => Promise<SystemInfo>
  }
  image: {
    openFileDialog: () => Promise<ScanResult | null>
    openDirectoryDialog: () => Promise<ScanResult | null>
    /** Build a queue from dropped/opened paths (files or directories). */
    openPaths: (paths: string[]) => Promise<ScanResult | null>
  }
  file: {
    /** Move to the OS trash. User confirmation is handled by the renderer UI. */
    trash: (filePath: string) => Promise<TrashResult>
    showInFolder: (filePath: string) => Promise<void>
    copyPath: (filePath: string) => Promise<void>
    /** Copy the decoded image to the clipboard. Returns false if the format can't be decoded natively. */
    copyImage: (filePath: string) => Promise<boolean>
    /** Begin a native OS file drag of the real file (drag-out to Finder/Explorer/web upload). */
    startDrag: (filePath: string) => void
    /** Diagnose why an image failed to load (missing / unreadable / present-but-undecodable). */
    probe: (filePath: string) => Promise<FileProbe>
    /** A non-existing export path: `<dir>/<base><suffix><ext>`, incrementing on conflict. */
    suggestExportPath: (filePath: string, suffix: string) => Promise<string>
    /** List a directory's immediate subdirectories (for the queue rail's folder browser). */
    listDirectory: (directory: string) => Promise<DirListing | null>
    /** Prompt for a target directory (save-to-target picker). Resolves null if cancelled. */
    chooseDirectory: () => Promise<string | null>
    /** Save (copy) images into a target folder under computed names (PRD §6.7); never moves the
     * original. Used for a single focused image; group/folder go through `task.startSaveBatch`. */
    saveToTarget: (request: SaveRequest) => Promise<SaveResult[]>
    /** Apply a validated, cycle-safe batch rename within one directory (PRD §6.8). */
    batchRename: (request: RenameExecRequest) => Promise<RenameResult>
    /** Write text to a user-chosen file (e.g. the rename log). Returns the path, or null if cancelled. */
    saveText: (defaultName: string, text: string) => Promise<string | null>
    /** Convert images to another format, writing new files (PRD §6.9); never overwrites the
     * original. Used for a single focused image; group/folder go through `task.startConvertBatch`. */
    convert: (request: ConvertRequest) => Promise<ConvertResult[]>
  }
  metadata: {
    /** Read full grouped Exif/XMP/IPTC/… metadata. Resolves null when the read fails. */
    read: (filePath: string) => Promise<ExifMetadata | null>
    /** Erase metadata per a rule, exporting a new file or modifying in place (PRD §6.5). */
    erase: (filePath: string, rule: EraseRule, target: EraseTarget) => Promise<EraseResult>
  }
  clipboard: {
    /** Write arbitrary text to the system clipboard (copy an Exif field or the full JSON). */
    writeText: (text: string) => Promise<void>
  }
  settings: {
    /** Read the full persisted settings (settings.json merged over defaults). */
    get: () => Promise<AppSettings>
    /** Merge a partial update into settings.json; returns the new full settings. */
    update: (patch: Partial<AppSettings>) => Promise<AppSettings>
    /** Reset all settings to defaults; returns them. */
    reset: () => Promise<AppSettings>
  }
  recent: {
    list: () => Promise<string[]>
    remove: (directory: string) => Promise<void>
    clear: () => Promise<void>
  }
  win: {
    toggleFullscreen: () => Promise<boolean>
    isFullscreen: () => Promise<boolean>
    /** Subscribe to fullscreen enter/leave (incl. OS-initiated). Returns an unsubscribe function. */
    onFullscreenChanged: (callback: (fullscreen: boolean) => void) => () => void
  }
  task: {
    /** Snapshot of all known tasks (newest first), for the batch page's initial render. */
    list: () => Promise<Task[]>
    /** Start a batch erase; returns the new task id. Progress arrives via `onUpdate`. */
    startEraseBatch: (request: BatchEraseRequest) => Promise<string>
    /** Start a batch save-to-target; returns the new task id. Progress arrives via `onUpdate`. */
    startSaveBatch: (request: SaveRequest) => Promise<string>
    /** Start a batch format conversion; returns the new task id. Progress arrives via `onUpdate`. */
    startConvertBatch: (request: ConvertRequest) => Promise<string>
    pause: (id: string) => Promise<void>
    resume: (id: string) => Promise<void>
    cancel: (id: string) => Promise<void>
    /** Re-run the failed files of a finished task as a new batch; returns the new id (or null). */
    retry: (id: string) => Promise<string | null>
    /** Write the task's log to a user-chosen file; returns the path (or null if cancelled). */
    exportLog: (id: string) => Promise<string | null>
    /** Drop finished (success/failed/cancelled) tasks from the list. */
    clearFinished: () => Promise<void>
    /** Subscribe to task-list updates pushed from main. Returns an unsubscribe function. */
    onUpdate: (callback: (tasks: Task[]) => void) => () => void
  }
}

/** IPC channel names — single source of truth for both ends. */
export const IpcChannel = {
  systemPing: 'system:ping',
  systemGetInfo: 'system:getInfo',
  imageOpenFileDialog: 'image:openFileDialog',
  imageOpenDirectoryDialog: 'image:openDirectoryDialog',
  imageOpenPaths: 'image:openPaths',
  fileTrash: 'file:trash',
  fileShowInFolder: 'file:showInFolder',
  fileCopyPath: 'file:copyPath',
  fileCopyImage: 'file:copyImage',
  fileStartDrag: 'file:startDrag',
  fileProbe: 'file:probe',
  fileSuggestExportPath: 'file:suggestExportPath',
  fileListDirectory: 'file:listDirectory',
  fileChooseDirectory: 'file:chooseDirectory',
  fileSaveToTarget: 'file:saveToTarget',
  fileBatchRename: 'file:batchRename',
  fileSaveText: 'file:saveText',
  fileConvert: 'file:convert',
  metadataRead: 'metadata:read',
  metadataErase: 'metadata:erase',
  clipboardWriteText: 'clipboard:writeText',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsReset: 'settings:reset',
  recentList: 'recent:list',
  recentRemove: 'recent:remove',
  recentClear: 'recent:clear',
  winToggleFullscreen: 'win:toggleFullscreen',
  winIsFullscreen: 'win:isFullscreen',
  /** Push channel: main → renderer, fired on fullscreen enter/leave. */
  winFullscreenChanged: 'win:fullscreenChanged',
  taskList: 'task:list',
  taskStartEraseBatch: 'task:startEraseBatch',
  taskStartSaveBatch: 'task:startSaveBatch',
  taskStartConvertBatch: 'task:startConvertBatch',
  taskPause: 'task:pause',
  taskResume: 'task:resume',
  taskCancel: 'task:cancel',
  taskRetry: 'task:retry',
  taskExportLog: 'task:exportLog',
  taskClearFinished: 'task:clearFinished',
  /** Push channel: main → renderer, full task-list snapshot on every change. */
  taskUpdate: 'task:update',
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]
