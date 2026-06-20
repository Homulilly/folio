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
    dimensions: (filePath) => ipcRenderer.invoke(IpcChannel.imageDimensions, filePath),
  },
  file: {
    trash: (filePath) => ipcRenderer.invoke(IpcChannel.fileTrash, filePath),
    showInFolder: (filePath) => ipcRenderer.invoke(IpcChannel.fileShowInFolder, filePath),
    copyPath: (filePath) => ipcRenderer.invoke(IpcChannel.fileCopyPath, filePath),
    copyImage: (filePath) => ipcRenderer.invoke(IpcChannel.fileCopyImage, filePath),
    startDrag: (filePath) => ipcRenderer.send(IpcChannel.fileStartDrag, filePath),
    probe: (filePath) => ipcRenderer.invoke(IpcChannel.fileProbe, filePath),
    suggestExportPath: (filePath, suffix) =>
      ipcRenderer.invoke(IpcChannel.fileSuggestExportPath, filePath, suffix),
    listDirectory: (directory) => ipcRenderer.invoke(IpcChannel.fileListDirectory, directory),
    chooseDirectory: () => ipcRenderer.invoke(IpcChannel.fileChooseDirectory),
    saveToTarget: (request) => ipcRenderer.invoke(IpcChannel.fileSaveToTarget, request),
    batchRename: (request) => ipcRenderer.invoke(IpcChannel.fileBatchRename, request),
    saveText: (defaultName, text) => ipcRenderer.invoke(IpcChannel.fileSaveText, defaultName, text),
    convert: (request) => ipcRenderer.invoke(IpcChannel.fileConvert, request),
  },
  metadata: {
    read: (filePath) => ipcRenderer.invoke(IpcChannel.metadataRead, filePath),
    erase: (filePath, rule, target) =>
      ipcRenderer.invoke(IpcChannel.metadataErase, filePath, rule, target),
  },
  clipboard: {
    writeText: (text) => ipcRenderer.invoke(IpcChannel.clipboardWriteText, text),
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannel.settingsGet),
    update: (patch) => ipcRenderer.invoke(IpcChannel.settingsUpdate, patch),
    reset: () => ipcRenderer.invoke(IpcChannel.settingsReset),
  },
  recent: {
    list: () => ipcRenderer.invoke(IpcChannel.recentList),
    remove: (directory) => ipcRenderer.invoke(IpcChannel.recentRemove, directory),
    clear: () => ipcRenderer.invoke(IpcChannel.recentClear),
  },
  win: {
    toggleFullscreen: () => ipcRenderer.invoke(IpcChannel.winToggleFullscreen),
    isFullscreen: () => ipcRenderer.invoke(IpcChannel.winIsFullscreen),
    onFullscreenChanged: (callback) => {
      const listener = (_e: unknown, fullscreen: boolean): void => callback(fullscreen)
      ipcRenderer.on(IpcChannel.winFullscreenChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannel.winFullscreenChanged, listener)
    },
  },
  task: {
    list: () => ipcRenderer.invoke(IpcChannel.taskList),
    startEraseBatch: (request) => ipcRenderer.invoke(IpcChannel.taskStartEraseBatch, request),
    startSaveBatch: (request) => ipcRenderer.invoke(IpcChannel.taskStartSaveBatch, request),
    startConvertBatch: (request) => ipcRenderer.invoke(IpcChannel.taskStartConvertBatch, request),
    pause: (id) => ipcRenderer.invoke(IpcChannel.taskPause, id),
    resume: (id) => ipcRenderer.invoke(IpcChannel.taskResume, id),
    cancel: (id) => ipcRenderer.invoke(IpcChannel.taskCancel, id),
    retry: (id) => ipcRenderer.invoke(IpcChannel.taskRetry, id),
    exportLog: (id) => ipcRenderer.invoke(IpcChannel.taskExportLog, id),
    clearFinished: () => ipcRenderer.invoke(IpcChannel.taskClearFinished),
    onUpdate: (callback) => {
      const listener = (_e: unknown, tasks: Parameters<typeof callback>[0]): void => callback(tasks)
      ipcRenderer.on(IpcChannel.taskUpdate, listener)
      return () => ipcRenderer.removeListener(IpcChannel.taskUpdate, listener)
    },
  },
  // webUtils resolves the absolute path of a dropped File (File.path was removed in Electron).
  getPathForFile: (file) => webUtils.getPathForFile(file),
}

// Renderer has zero direct Node/fs access; everything goes through this typed bridge.
contextBridge.exposeInMainWorld('gv', api)
