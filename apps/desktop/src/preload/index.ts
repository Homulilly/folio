import { type FolioApi, IpcChannel } from '@folio/shared-types'
import { contextBridge, ipcRenderer, webUtils } from 'electron'

/** The IPC contract plus preload-local DOM helpers (getPathForFile is a direct webUtils call). */
export type Bridge = FolioApi & {
  getPathForFile: (file: File) => string
}

const api: Bridge = {
  system: {
    ping: () => ipcRenderer.invoke(IpcChannel.systemPing),
    getInfo: () => ipcRenderer.invoke(IpcChannel.systemGetInfo),
  },
  image: {
    openFileDialog: () => ipcRenderer.invoke(IpcChannel.imageOpenFileDialog),
    openDirectoryDialog: () => ipcRenderer.invoke(IpcChannel.imageOpenDirectoryDialog),
    openPaths: (paths) => ipcRenderer.invoke(IpcChannel.imageOpenPaths, paths),
  },
  file: {
    trash: (filePath) => ipcRenderer.invoke(IpcChannel.fileTrash, filePath),
    showInFolder: (filePath) => ipcRenderer.invoke(IpcChannel.fileShowInFolder, filePath),
    copyPath: (filePath) => ipcRenderer.invoke(IpcChannel.fileCopyPath, filePath),
    copyImage: (filePath) => ipcRenderer.invoke(IpcChannel.fileCopyImage, filePath),
  },
  recent: {
    list: () => ipcRenderer.invoke(IpcChannel.recentList),
    remove: (directory) => ipcRenderer.invoke(IpcChannel.recentRemove, directory),
    clear: () => ipcRenderer.invoke(IpcChannel.recentClear),
  },
  win: {
    toggleFullscreen: () => ipcRenderer.invoke(IpcChannel.winToggleFullscreen),
    isFullscreen: () => ipcRenderer.invoke(IpcChannel.winIsFullscreen),
  },
  // webUtils resolves the absolute path of a dropped File (File.path was removed in Electron).
  getPathForFile: (file) => webUtils.getPathForFile(file),
}

// Renderer has zero direct Node/fs access; everything goes through this typed bridge.
contextBridge.exposeInMainWorld('gv', api)
