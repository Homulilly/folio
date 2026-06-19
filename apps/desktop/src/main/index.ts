import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, shell } from 'electron'
import { registerIpcHandlers } from './ipc'
import { handleImageProtocol, registerImageProtocolSchemes } from './protocol'
import { endExifTool } from './services/exiftool'

app.setName('Folio')

// Must run before app `ready`.
registerImageProtocolSchemes()

let mainWindow: BrowserWindow | null = null

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

  mainWindow = win
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

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
  registerIpcHandlers(() => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Tear down the persistent ExifTool child process so it doesn't outlive the app.
app.on('will-quit', () => {
  void endExifTool()
})
