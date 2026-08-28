import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { IPC } from '@shared/ipc-channels'
import {
  APP_TITLE,
  DEFAULT_SAVE_FILENAME,
  MARKDOWN_DIALOG_FILTERS,
} from '@shared/constants'
import type { OpenFileResult, OpenFolderResult, SaveFilePayload, SaveFileResult } from '@shared/file-types'
import { scanWorkspace } from './workspace'

let mainWindow: BrowserWindow | null = null

const markdownFilters = MARKDOWN_DIALOG_FILTERS

async function openFileDialog(): Promise<OpenFileResult | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '打开 Markdown 文件',
    filters: markdownFilters,
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) return null

  const filePath = filePaths[0]!
  const content = await readFile(filePath, 'utf-8')
  return { filePath, content }
}

async function openFolderDialog(): Promise<OpenFolderResult | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '打开文件夹',
    properties: ['openDirectory'],
  })

  if (canceled || filePaths.length === 0) return null

  const rootPath = filePaths[0]!
  const tree = await scanWorkspace(rootPath)
  return { rootPath, tree }
}

async function readFileByPath(filePath: string): Promise<OpenFileResult> {
  const content = await readFile(filePath, 'utf-8')
  return { filePath, content }
}

async function saveFileDialog(payload: SaveFilePayload): Promise<SaveFileResult | null> {
  let filePath = payload.filePath

  if (!filePath) {
    const { canceled, filePath: selectedPath } = await dialog.showSaveDialog({
      title: '保存 Markdown 文件',
      filters: markdownFilters,
      defaultPath: DEFAULT_SAVE_FILENAME,
    })

    if (canceled || !selectedPath) return null
    filePath = selectedPath
  }

  await writeFile(filePath, payload.content, 'utf-8')
  return { filePath }
}

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
  ipcMain.handle(IPC.FILE_SAVE, (_event, payload: SaveFilePayload) =>
    saveFileDialog(payload),
  )
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
