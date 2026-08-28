import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { basename, join } from 'path'
import { IPC } from '@shared/ipc-channels'
import { APP_TITLE } from '@shared/constants'
import type { SaveFilePayload } from '@shared/file-types'
import {
  openFileDialog,
  openFolderDialog,
  readFileByPath,
  saveFileDialog,
} from './file-service'

let mainWindow: BrowserWindow | null = null

function updateWindowTitle(filePath?: string, isDirty = false): void {
  if (!mainWindow) return

  const dirtyMark = isDirty ? ' •' : ''
  if (filePath) {
    mainWindow.setTitle(`${basename(filePath)}${dirtyMark} — ${APP_TITLE}`)
  } else {
    mainWindow.setTitle(`未命名${dirtyMark} — ${APP_TITLE}`)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1e1e1e',
    title: APP_TITLE,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.setMenu(null)
    mainWindow?.setMenuBarVisibility(false)
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[preload-error]', preloadPath, error)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())
  ipcMain.handle(IPC.FILE_OPEN, () => openFileDialog())
  ipcMain.handle(IPC.FILE_OPEN_FOLDER, () => openFolderDialog())
  ipcMain.handle(IPC.FILE_READ, (_event, filePath: string) => readFileByPath(filePath))
  ipcMain.handle(IPC.FILE_SAVE, (_event, payload: SaveFilePayload) => saveFileDialog(payload))
  ipcMain.handle(IPC.FILE_SAVE_AS, (_event, payload: SaveFilePayload) =>
    saveFileDialog({ ...payload, filePath: undefined }),
  )
  ipcMain.on(IPC.FILE_UPDATE_TITLE, (_event, payload: { filePath?: string; isDirty: boolean }) => {
    updateWindowTitle(payload.filePath, payload.isDirty)
  })
  ipcMain.on(IPC.APP_QUIT, () => app.quit())
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
