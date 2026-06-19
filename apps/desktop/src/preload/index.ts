import { type GalleryViewerApi, IpcChannel } from '@galleryviewer/shared-types'
import { contextBridge, ipcRenderer } from 'electron'

const api: GalleryViewerApi = {
  system: {
    ping: () => ipcRenderer.invoke(IpcChannel.systemPing),
    getInfo: () => ipcRenderer.invoke(IpcChannel.systemGetInfo),
  },
}

// Renderer has zero direct Node/fs access; everything goes through this typed bridge.
contextBridge.exposeInMainWorld('gv', api)
