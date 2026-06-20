// IPC contract between renderer (via preload contextBridge) and main process.
// Namespaces follow PRD §9.2: image.* / file.* / recent.* / win.* (+ system.*).

import type { ImageQueueItem, Task } from './domain'
import type { BatchEraseRequest, EraseResult, EraseRule, EraseTarget } from './erase'
import type { ExifMetadata } from './metadata'

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
    /** A non-existing export path: `<dir>/<base><suffix><ext>`, incrementing on conflict. */
    suggestExportPath: (filePath: string, suffix: string) => Promise<string>
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
  recent: {
    list: () => Promise<string[]>
    remove: (directory: string) => Promise<void>
    clear: () => Promise<void>
  }
  win: {
    toggleFullscreen: () => Promise<boolean>
    isFullscreen: () => Promise<boolean>
  }
  task: {
    /** Snapshot of all known tasks (newest first), for the batch page's initial render. */
    list: () => Promise<Task[]>
    /** Start a batch erase; returns the new task id. Progress arrives via `onUpdate`. */
    startEraseBatch: (request: BatchEraseRequest) => Promise<string>
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
  fileSuggestExportPath: 'file:suggestExportPath',
  metadataRead: 'metadata:read',
  metadataErase: 'metadata:erase',
  clipboardWriteText: 'clipboard:writeText',
  recentList: 'recent:list',
  recentRemove: 'recent:remove',
  recentClear: 'recent:clear',
  winToggleFullscreen: 'win:toggleFullscreen',
  winIsFullscreen: 'win:isFullscreen',
  taskList: 'task:list',
  taskStartEraseBatch: 'task:startEraseBatch',
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
