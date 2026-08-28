import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { IPC } from '../shared/ipc-channels'
import type { OpenFileResult, SaveFilePayload, SaveFileResult } from '../shared/file-types'

let mainWindow: BrowserWindow | null = null

const markdownFilters = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
  { name: 'All Files', extensions: ['*'] },
]

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

async function saveFileDialog(payload: SaveFilePayload): Promise<SaveFileResult | null> {
  let filePath = payload.filePath

  if (!filePath) {
    const { canceled, filePath: selectedPath } = await dialog.showSaveDialog({
      title: '保存 Markdown 文件',
      filters: markdownFilters,
      defaultPath: 'untitled.md',
    })

    if (canceled || !selectedPath) return null
    filePath = selectedPath
  }

  await writeFile(filePath, payload.content, 'utf-8')
  return { filePath }
}

function updateWindowTitle(filePath?: string, isDirty = false): void {
  if (!mainWindow) return

  const dirtyMark = isDirty ? ' *' : ''
  if (filePath) {
    mainWindow.setTitle(`${basename(filePath)}${dirtyMark} - Markdown Editor`)
  } else {
    mainWindow.setTitle(`未命名${dirtyMark} - Markdown Editor`)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    title: 'Markdown Editor',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
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

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send(IPC.FILE_MENU_OPEN),
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send(IPC.FILE_MENU_SAVE),
        },
        {
          label: '另存为',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send(IPC.FILE_MENU_SAVE_AS),
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 Markdown Editor',
          click: () => {
            mainWindow?.webContents.send(IPC.APP_SHOW_ABOUT)
          },
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())
  ipcMain.handle(IPC.FILE_OPEN, () => openFileDialog())
  ipcMain.handle(IPC.FILE_SAVE, (_event, payload: SaveFilePayload) =>
    saveFileDialog(payload),
  )
  ipcMain.handle(IPC.FILE_SAVE_AS, (_event, payload: SaveFilePayload) =>
    saveFileDialog({ ...payload, filePath: undefined }),
  )
  ipcMain.on(IPC.FILE_UPDATE_TITLE, (_event, payload: { filePath?: string; isDirty: boolean }) => {
    updateWindowTitle(payload.filePath, payload.isDirty)
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createMenu()
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
