import { SUPPORTED_EXTENSIONS } from '@folio/image-processing'
import { IpcChannel, type ScanResult, type SystemInfo, type TrashResult } from '@folio/shared-types'
import { app, type BrowserWindow, clipboard, dialog, ipcMain, nativeImage, shell } from 'electron'
import { addRecentFolder, clearRecentFolders, listRecentFolders } from './services/recent'
import { buildScanResult } from './services/scan'

const IMAGE_EXTENSIONS = [...SUPPORTED_EXTENSIONS]

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

  // --- recent folders ---
  ipcMain.handle(IpcChannel.recentList, (): Promise<string[]> => listRecentFolders())
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
}
