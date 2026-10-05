import { app, BrowserWindow, ipcMain, screen, session, shell } from 'electron'
import path from 'node:path'
import { clearInstallation, ensureDeviceUuid, getInstallation, saveInstallation, type StoredInstallation } from './store.js'
import { hardwareSnapshot, printJob, recordCapture, setPrintWindowSource, updateCameraReport, type CameraReport, type PrintRequest } from './hardware.js'
import { getPreloadPath } from './pathResolver.js'
import { isDev } from './util.js'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const displays = screen.getAllDisplays()
  const targetDisplay = displays.find((display) => display.id !== primaryDisplay.id) ?? primaryDisplay
  const bounds = targetDisplay.workArea

  mainWindow = new BrowserWindow({
    title: 'HappyPix Booth',
    x: bounds.x,
    y: bounds.y,
    width: isDev() ? Math.min(1280, bounds.width) : bounds.width,
    height: isDev() ? Math.min(800, bounds.height) : bounds.height,
    minWidth: 720,
    minHeight: 720,
    backgroundColor: '#0b0714',
    autoHideMenuBar: true,
    kiosk: !isDev(),
    fullscreen: !isDev(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev(),
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev() ? url.startsWith('http://localhost:8888') : url.startsWith('file://')
    if (!allowed) event.preventDefault()
  })

  if (isDev()) {
    void mainWindow.loadURL('http://localhost:8888')
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), 'dist-react', 'index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('booth:get-installation', () => getInstallation())
  ipcMain.handle('booth:get-device-uuid', () => ensureDeviceUuid())
  ipcMain.handle('booth:save-installation', (_event, value: StoredInstallation) => saveInstallation(value))
  ipcMain.handle('booth:clear-installation', () => clearInstallation())
  ipcMain.handle('booth:system-snapshot', () => hardwareSnapshot())
  ipcMain.handle('booth:camera-report', (_event, value: CameraReport) => updateCameraReport(value))
  ipcMain.handle('booth:record-capture', () => recordCapture())
  ipcMain.handle('booth:print', (_event, value: PrintRequest) => printJob(value))
  ipcMain.handle('booth:set-kiosk', (_event, enabled: boolean) => {
    if (!mainWindow) return false
    mainWindow.setKiosk(enabled)
    mainWindow.setFullScreen(enabled)
    return mainWindow.isKiosk()
  })
  ipcMain.handle('booth:app-info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    packaged: app.isPackaged,
  }))
}

app.whenReady().then(() => {
  registerIpc()
  setPrintWindowSource(() => mainWindow)
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'media')
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })
  createWindow()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
