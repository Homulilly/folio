// IPC contract between renderer (via preload contextBridge) and main process.
// Grow this per PRD §9.2 namespaces: image.* / queue.* / multiView.* / metadata.* / file.* / task.*
// M0 ships the `system` namespace only — a typed end-to-end smoke test.

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

/**
 * The full surface exposed on `window.gv` by the preload bridge.
 * Every method is async (backed by ipcRenderer.invoke). Renderer has zero direct fs access.
 */
export interface GalleryViewerApi {
  system: {
    ping: () => Promise<'pong'>
    getInfo: () => Promise<SystemInfo>
  }
}

/** IPC channel names — single source of truth for both ends. */
export const IpcChannel = {
  systemPing: 'system:ping',
  systemGetInfo: 'system:getInfo',
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]
