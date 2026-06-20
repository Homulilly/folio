import { constants, statSync } from 'node:fs'
import { access, stat, writeFile } from 'node:fs/promises'
import { SUPPORTED_EXTENSIONS } from '@folio/image-processing'
import {
  type AppSettings,
  type BatchEraseRequest,
  type ConvertRequest,
  type ConvertResult,
  type DirListing,
  type EraseResult,
  type EraseRule,
  type EraseTarget,
  type ExifMetadata,
  type FileProbe,
  IpcChannel,
  type RenameExecRequest,
  type RenameResult,
  type SaveRequest,
  type SaveResult,
  type ScanResult,
  type SettingsPatch,
  type SystemInfo,
  type Task,
  type TrashResult,
} from '@folio/shared-types'
import { app, type BrowserWindow, clipboard, dialog, ipcMain, nativeImage, shell } from 'electron'
import { convertFile } from './services/convert'
import { eraseMetadata, readMetadata } from './services/exiftool'
import { suggestExportPath } from './services/paths'
import {
  addRecentFolder,
  clearRecentFolders,
  listRecentFolders,
  removeRecentFolder,
} from './services/recent'
import { renameInDirectory } from './services/rename'
import { nowStamp, saveFile } from './services/save'
import { buildScanResult, listDirectory } from './services/scan'
import { getSettings, resetSettings, updateSettings } from './services/settings'
import { taskScheduler } from './services/taskScheduler'

const IMAGE_EXTENSIONS = [...SUPPORTED_EXTENSIONS]

// Native file drag-out: the drag image is a small thumbnail of the file itself, capped so a huge
// photo doesn't produce a giant cursor. Falls back to a neutral square if the file can't be decoded.
const DRAG_ICON_MAX_SIDE = 56
const FALLBACK_DRAG_ICON = nativeImage.createFromDataURL(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAK0lEQVR42mNkoBAwUqifYdQAhtEwCkbDKBgNo2AUjIJRMApGwSgYBQAAepcBwa1EIb0AAAAASUVORK5CYII=',
)

function isExistingFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}

function dragIconForFile(filePath: string): Electron.NativeImage {
  const icon = nativeImage.createFromPath(filePath)
  if (icon.isEmpty()) return FALLBACK_DRAG_ICON
  const { width, height } = icon.getSize()
  if (width <= 0 || height <= 0) return FALLBACK_DRAG_ICON
  const scale = Math.min(DRAG_ICON_MAX_SIDE / width, DRAG_ICON_MAX_SIDE / height, 1)
  return icon.resize({
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    quality: 'best',
  })
}

async function rememberDirectory(result: ScanResult | null): Promise<ScanResult | null> {
  if (result?.directory) await addRecentFolder(result.directory)
  return result
}

/**
 * Register all main-process IPC handlers.
 * @param getWindow returns the window to target for window-scoped operations.
 */
export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  // --- system ---
  ipcMain.handle(IpcChannel.systemPing, (): 'pong' => 'pong')
  ipcMain.handle(
    IpcChannel.systemGetInfo,
    (): SystemInfo => ({
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    }),
  )

  // --- image / queue ---
  const showOpen = (options: Electron.OpenDialogOptions) => {
    const win = getWindow()
    return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options)
  }

  ipcMain.handle(IpcChannel.imageOpenFileDialog, async (): Promise<ScanResult | null> => {
    const result = await showOpen({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return rememberDirectory(await buildScanResult(result.filePaths))
  })

  ipcMain.handle(IpcChannel.imageOpenDirectoryDialog, async (): Promise<ScanResult | null> => {
    const result = await showOpen({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return rememberDirectory(await buildScanResult(result.filePaths))
  })

  ipcMain.handle(
    IpcChannel.imageOpenPaths,
    (_e, paths: string[]): Promise<ScanResult | null> =>
      buildScanResult(paths).then(rememberDirectory),
  )

  // --- file actions ---
  ipcMain.handle(IpcChannel.fileTrash, async (_e, filePath: string): Promise<TrashResult> => {
    try {
      await shell.trashItem(filePath)
      return 'trashed'
    } catch {
      return 'failed'
    }
  })
  ipcMain.handle(IpcChannel.fileShowInFolder, (_e, filePath: string): void => {
    shell.showItemInFolder(filePath)
  })
  ipcMain.handle(IpcChannel.fileCopyPath, (_e, filePath: string): void => {
    clipboard.writeText(filePath)
  })
  ipcMain.handle(IpcChannel.fileCopyImage, (_e, filePath: string): boolean => {
    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) return false
    clipboard.writeImage(image)
    return true
  })
  // Fire-and-forget: the renderer's dragstart hands us a path; main owns the OS drag session.
  ipcMain.on(IpcChannel.fileStartDrag, (event, filePath: string): void => {
    if (typeof filePath !== 'string' || !isExistingFile(filePath)) return
    event.sender.startDrag({ file: filePath, icon: dragIconForFile(filePath) })
  })
  // Diagnose a failed image load: gone/not-a-file → missing, present but no read access →
  // unreadable, otherwise it's a decode/format problem (decodable = the bytes are reachable).
  ipcMain.handle(IpcChannel.fileProbe, async (_e, filePath: string): Promise<FileProbe> => {
    try {
      if (!(await stat(filePath)).isFile()) return 'missing'
    } catch {
      return 'missing'
    }
    try {
      await access(filePath, constants.R_OK)
      return 'decodable'
    } catch {
      return 'unreadable'
    }
  })
  ipcMain.handle(
    IpcChannel.fileSuggestExportPath,
    (_e, filePath: string, suffix: string): Promise<string> => suggestExportPath(filePath, suffix),
  )
  ipcMain.handle(
    IpcChannel.fileListDirectory,
    (_e, directory: string): Promise<DirListing | null> => listDirectory(directory),
  )
  ipcMain.handle(IpcChannel.fileChooseDirectory, async (): Promise<string | null> => {
    const result = await showOpen({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0] as string
  })
  // Single/direct save-to-target (a focused image, or a small set). Group/folder go through the
  // scheduler (task:startSaveBatch) so they get progress + the batch page (PRD §6.7).
  ipcMain.handle(
    IpcChannel.fileSaveToTarget,
    async (_e, request: SaveRequest): Promise<SaveResult[]> => {
      const stamp = nowStamp()
      const results: SaveResult[] = []
      for (let i = 0; i < request.files.length; i++) {
        const input = request.files[i] as SaveRequest['files'][number]
        results.push(
          await saveFile(input, i, request.targetDir, request.naming, request.conflict, stamp),
        )
      }
      return results
    },
  )
  ipcMain.handle(
    IpcChannel.fileBatchRename,
    (_e, request: RenameExecRequest): Promise<RenameResult> => renameInDirectory(request),
  )
  // Single/direct convert (a focused image). Group/folder go through task:startConvertBatch.
  ipcMain.handle(
    IpcChannel.fileConvert,
    async (_e, request: ConvertRequest): Promise<ConvertResult[]> => {
      const results: ConvertResult[] = []
      for (const filePath of request.filePaths) {
        results.push(
          await convertFile(filePath, request.targetDir, request.options, request.conflict),
        )
      }
      return results
    },
  )
  ipcMain.handle(
    IpcChannel.fileSaveText,
    async (_e, defaultName: string, text: string): Promise<string | null> => {
      const win = getWindow()
      const result = await (win
        ? dialog.showSaveDialog(win, { defaultPath: defaultName })
        : dialog.showSaveDialog({ defaultPath: defaultName }))
      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, text, 'utf8')
      return result.filePath
    },
  )

  // --- metadata (Exif) ---
  ipcMain.handle(
    IpcChannel.metadataRead,
    (_e, filePath: string): Promise<ExifMetadata | null> => readMetadata(filePath),
  )
  ipcMain.handle(
    IpcChannel.metadataErase,
    (_e, filePath: string, rule: EraseRule, target: EraseTarget): Promise<EraseResult> =>
      eraseMetadata(filePath, rule, target),
  )

  ipcMain.handle(IpcChannel.clipboardWriteText, (_e, text: string): void => {
    clipboard.writeText(text)
  })

  // --- settings (settings.json) ---
  ipcMain.handle(IpcChannel.settingsGet, (): AppSettings => getSettings())
  ipcMain.handle(
    IpcChannel.settingsUpdate,
    (_e, patch: SettingsPatch): AppSettings => updateSettings(patch),
  )
  ipcMain.handle(IpcChannel.settingsReset, (): AppSettings => resetSettings())

  // --- recent folders ---
  ipcMain.handle(IpcChannel.recentList, (): Promise<string[]> => listRecentFolders())
  ipcMain.handle(
    IpcChannel.recentRemove,
    (_e, directory: string): Promise<void> => removeRecentFolder(directory),
  )
  ipcMain.handle(IpcChannel.recentClear, (): Promise<void> => clearRecentFolders())

  // --- window controls ---
  ipcMain.handle(IpcChannel.winToggleFullscreen, (): boolean => {
    const win = getWindow()
    if (!win) return false
    const next = !win.isFullScreen()
    win.setFullScreen(next)
    return next
  })
  ipcMain.handle(IpcChannel.winIsFullscreen, (): boolean => getWindow()?.isFullScreen() ?? false)

  // --- task scheduler (batch operations, PRD §9.3) ---
  // Push the full task list to the renderer after every scheduler mutation.
  taskScheduler.setEmitter(() => {
    getWindow()?.webContents.send(IpcChannel.taskUpdate, taskScheduler.list())
  })
  // Restore persisted finished tasks (app is ready here, so the cache DB is available).
  taskScheduler.init()

  ipcMain.handle(IpcChannel.taskList, (): Task[] => taskScheduler.list())
  ipcMain.handle(IpcChannel.taskStartEraseBatch, (_e, request: BatchEraseRequest): string =>
    taskScheduler.startEraseBatch(request),
  )
  ipcMain.handle(IpcChannel.taskStartSaveBatch, (_e, request: SaveRequest): string =>
    taskScheduler.startSaveBatch(request),
  )
  ipcMain.handle(IpcChannel.taskStartConvertBatch, (_e, request: ConvertRequest): string =>
    taskScheduler.startConvertBatch(request),
  )
  ipcMain.handle(IpcChannel.taskPause, (_e, id: string): void => taskScheduler.pause(id))
  ipcMain.handle(IpcChannel.taskResume, (_e, id: string): void => taskScheduler.resume(id))
  ipcMain.handle(IpcChannel.taskCancel, (_e, id: string): void => taskScheduler.cancel(id))
  ipcMain.handle(IpcChannel.taskRetry, (_e, id: string): string | null => taskScheduler.retry(id))
  ipcMain.handle(IpcChannel.taskClearFinished, (): void => taskScheduler.clearFinished())

  ipcMain.handle(IpcChannel.taskExportLog, async (_e, id: string): Promise<string | null> => {
    const text = taskScheduler.logText(id)
    if (text === null) return null
    const win = getWindow()
    const result = await (win
      ? dialog.showSaveDialog(win, { defaultPath: `folio-task-${id}.log` })
      : dialog.showSaveDialog({ defaultPath: `folio-task-${id}.log` }))
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, text, 'utf8')
    return result.filePath
  })
}
