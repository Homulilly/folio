// IPC contract between renderer (via preload contextBridge) and main process.
// Namespaces follow PRD §9.2: image.* / file.* / recent.* / win.* (+ system.*).

import type { ImageQueueItem } from './domain'

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
  }
  recent: {
    list: () => Promise<string[]>
    clear: () => Promise<void>
  }
  win: {
    toggleFullscreen: () => Promise<boolean>
    isFullscreen: () => Promise<boolean>
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
  recentList: 'recent:list',
  recentClear: 'recent:clear',
  winToggleFullscreen: 'win:toggleFullscreen',
  winIsFullscreen: 'win:isFullscreen',
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]
