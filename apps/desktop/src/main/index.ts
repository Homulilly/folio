import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, shell } from 'electron'
import { registerIpcHandlers } from './ipc'
import { handleImageProtocol, registerImageProtocolSchemes } from './protocol'

// Must run before app `ready`.
registerImageProtocolSchemes()

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: '#1C1C1E',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  // Keep navigation inside the app; open external links in the OS browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)))
  }
}

app.whenReady().then(() => {
  handleImageProtocol()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
