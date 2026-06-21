import { fileURLToPath } from 'node:url'
import { IpcChannel } from '@folio/shared-types'
import { app, BrowserWindow, shell } from 'electron'
import { registerIpcHandlers } from './ipc'
import { handleImageProtocol, registerImageProtocolSchemes } from './protocol'
import { closeDb } from './services/db'
import { endExifTool } from './services/exiftool'
import { initLogging, startCrashReporter } from './services/logging'

app.setName('Folio')

// Must run before app `ready`.
registerImageProtocolSchemes()
// Capture native crashes locally (never uploaded); earliest possible so early crashes are caught.
startCrashReporter()

let mainWindow: BrowserWindow | null = null

/**
 * Only hand http/https URLs to the OS browser. file://, smb:// (NTLM leak on Windows) and custom
 * protocol handlers invoke OS handlers directly — outside the renderer's CSP — so a compromised
 * renderer must not be able to launch them via window.open.
 */
function isSafeExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: '#1C1C1E',
    // macOS: hiddenInset keeps native traffic lights inset over our custom bar.
    // Windows: hide the native frame and paint the min/max/close buttons as a Controls Overlay,
    // themed to match the #1C1C1E title bar (38px to align with the custom TitleBar height).
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'win32'
      ? { titleBarOverlay: { color: '#1C1C1E', symbolColor: '#9b9b9f', height: 38 } }
      : {}),
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

  // Mirror fullscreen state to the renderer (covers F11, the toolbar button, and OS-initiated
  // fullscreen via the macOS green button / Ctrl+Cmd+F) so it can switch to the immersive layout.
  win.on('enter-full-screen', () => win.webContents.send(IpcChannel.winFullscreenChanged, true))
  win.on('leave-full-screen', () => win.webContents.send(IpcChannel.winFullscreenChanged, false))

  // Open external links in the OS browser, but only safe web schemes (see isSafeExternalUrl).
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // Lock top-level navigation to the app's own content: block any attempt to navigate the window
  // away (e.g. an injected location change to file:// or a remote origin). Reloads to the same URL
  // are allowed so dev HMR / refresh still work.
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)))
  }
}

app.whenReady().then(() => {
  initLogging()
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

// Tear down the persistent ExifTool child process and checkpoint/close the cache DB on quit.
app.on('will-quit', () => {
  void endExifTool()
  closeDb()
})
