import { IpcChannel, type SystemInfo } from '@galleryviewer/shared-types'
import { app, ipcMain } from 'electron'

/**
 * Register all main-process IPC handlers. Grows per PRD §9.2 namespaces.
 * M0: the `system` namespace only — proves the typed renderer→main round trip.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.systemPing, (): 'pong' => 'pong')

  ipcMain.handle(IpcChannel.systemGetInfo, (): SystemInfo => {
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    }
  })
}
