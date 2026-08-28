import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage } from 'electron'
import { basename, join } from 'path'
import { IPC } from '@shared/ipc-channels'
import { APP_TITLE } from '@shared/constants'
import type {
  ExportDocumentPayload,
  OpenDialogOptions,
  SaveFilePayload,
  SavePastedImagePayload,
} from '@shared/file-types'
import {
  exportHtmlDocument,
  exportPdfDocument,
  openDocumentDialog,
  openFolderDialog,
  scanWorkspaceFolder,
  readBinaryFileByPath,
  readFileByPath,
  readImageAsDataUrl,
  saveFileDialog,
  savePastedImage,
} from './file-service'
import { getAppVersion } from './app-service'
import { resolveAppIconPath } from './app-paths'
import { appendRendererErrorLog, getErrorLogFilePath } from './error-log-service'
import type { RendererErrorPayload } from '@shared/error-log-types'
import { ok } from '@shared/result'
import {
  createWindowCloseController,
  type WindowCloseController,
} from './window-close'
import type { RendererHealth } from './close-gate'

let mainWindow: BrowserWindow | null = null
let allowClose = false
let documentDirty = false
let verboseRendererLogs = false
let rendererHealth: RendererHealth = 'ok'
let windowCloseController: WindowCloseController | null = null

function updateWindowTitle(filePath?: string, isDirty = false): void {
  if (!mainWindow) return

  const dirtyMark = isDirty ? ' •' : ''
  if (filePath) {
    mainWindow.setTitle(`${basename(filePath)}${dirtyMark} — ${APP_TITLE}`)
  } else {
    mainWindow.setTitle(`未命名${dirtyMark} — ${APP_TITLE}`)
  }
}

function createWindowCloseHandlers(): WindowCloseController {
  return createWindowCloseController({
    getMainWindow: () => mainWindow,
    getAllowClose: () => allowClose,
    setAllowClose: (value) => {
      allowClose = value
    },
    getDocumentDirty: () => documentDirty,
    getRendererHealth: () => rendererHealth,
    onRequestRendererClose: (win) => {
      win.webContents.send(IPC.APP_REQUEST_CLOSE)
    },
  })
}

function createWindow(): void {
  allowClose = false
  documentDirty = false
  rendererHealth = 'ok'
  windowCloseController = createWindowCloseHandlers()

  const iconPath = resolveAppIconPath()
  const windowIcon = iconPath ? nativeImage.createFromPath(iconPath) : undefined

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1e1e1e',
    title: APP_TITLE,
    icon: windowIcon,
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

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[render-process-gone]', details.reason, details.exitCode)
    rendererHealth = 'crashed'
    windowCloseController?.clearPendingCloseTimeout()

    const win = mainWindow
    if (!win || win.isDestroyed()) return

    void dialog
      .showMessageBox(win, {
        type: 'error',
        title: '界面进程异常',
        message: '编辑器渲染进程已崩溃或异常退出',
        detail: `原因：${details.reason}（exitCode ${details.exitCode}）\n\n可尝试重新加载；若反复出现，请用 Ctrl+Shift+I 查看 Console，或在 帮助 → 错误日志 中查看记录。`,
        buttons: ['重新加载', '关闭窗口'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (win.isDestroyed()) return
        if (response === 0) {
          rendererHealth = 'ok'
          win.reload()
          return
        }
        windowCloseController?.forceCloseWindow(win)
      })
  })

  mainWindow.webContents.on('did-finish-load', () => {
    rendererHealth = 'ok'
  })

  mainWindow.webContents.on('responsive', () => {
    rendererHealth = 'ok'
    console.info('[renderer-responsive] 渲染进程已恢复响应')
  })

  mainWindow.webContents.on('unresponsive', () => {
    rendererHealth = 'unresponsive'
    console.error('[renderer-unresponsive] 渲染进程无响应，可能正在处理大文件或发生死循环')
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow?.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  mainWindow.on('close', (event) => {
    windowCloseController?.handleWindowClose(event)
  })

  mainWindow.on('closed', () => {
    windowCloseController?.clearPendingCloseTimeout()
    mainWindow = null
  })

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[preload-error]', preloadPath, error)
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[did-fail-load]', errorCode, errorDescription, validatedURL)
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const isErrorLike = level >= 3 || /error|exception|uncaught/i.test(message)
    if (isErrorLike || verboseRendererLogs) {
      console.error('[renderer]', message, `(${sourceId}:${line})`)
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.APP_GET_VERSION, () => getAppVersion())
  ipcMain.on(IPC.APP_SET_DIRTY, (_event, isDirty: boolean) => {
    documentDirty = isDirty
  })
  ipcMain.on(IPC.APP_CLOSE_DECISION, (_event, decision: 'proceed' | 'cancel') => {
    windowCloseController?.handleRendererCloseDecision(decision)
  })
  ipcMain.handle(IPC.FILE_OPEN, (_event, options?: OpenDialogOptions) =>
    openDocumentDialog(options),
  )
  ipcMain.handle(IPC.FILE_OPEN_FOLDER, (_event, options?: OpenDialogOptions) =>
    openFolderDialog(options),
  )
  ipcMain.handle(IPC.FILE_SCAN_WORKSPACE, (_event, rootPath: string) =>
    scanWorkspaceFolder(rootPath),
  )
  ipcMain.handle(IPC.FILE_READ, (_event, filePath: string) => readFileByPath(filePath))
  ipcMain.handle(IPC.FILE_READ_BINARY, (_event, filePath: string) =>
    readBinaryFileByPath(filePath),
  )
  ipcMain.handle(IPC.FILE_READ_IMAGE, (_event, filePath: string) => readImageAsDataUrl(filePath))
  ipcMain.handle(IPC.FILE_SAVE, (_event, payload: SaveFilePayload) => saveFileDialog(payload))
  ipcMain.handle(IPC.FILE_SAVE_AS, (_event, payload: SaveFilePayload) =>
    saveFileDialog({ ...payload, filePath: undefined }),
  )
  ipcMain.handle(IPC.FILE_SAVE_PASTED_IMAGE, (_event, payload: SavePastedImagePayload) =>
    savePastedImage(payload),
  )
  ipcMain.handle(IPC.FILE_EXPORT_HTML, (_event, payload: ExportDocumentPayload) =>
    exportHtmlDocument(payload),
  )
  ipcMain.handle(IPC.FILE_EXPORT_PDF, (_event, payload: ExportDocumentPayload) =>
    exportPdfDocument(payload),
  )
  ipcMain.on(IPC.FILE_UPDATE_TITLE, (_event, payload: { filePath?: string; isDirty: boolean }) => {
    updateWindowTitle(payload.filePath, payload.isDirty)
  })
  ipcMain.on(IPC.APP_QUIT, () => {
    mainWindow?.close()
  })
  ipcMain.on(IPC.APP_TOGGLE_DEVTOOLS, () => {
    mainWindow?.webContents.toggleDevTools()
  })
  ipcMain.on(IPC.APP_SET_VERBOSE_LOGS, (_event, enabled: boolean) => {
    verboseRendererLogs = enabled
  })
  ipcMain.handle(IPC.APP_LOG_RENDERER_ERROR, async (_event, payload: RendererErrorPayload) => {
    try {
      const logPath = await appendRendererErrorLog(payload)
      console.error('[renderer-error-log]', payload.source, payload.message)
      return ok(logPath)
    } catch (error) {
      console.error('[renderer-error-log] 写入失败', error)
      return ok(getErrorLogFilePath())
    }
  })
  ipcMain.handle(IPC.APP_GET_ERROR_LOG_PATH, () => ok(getErrorLogFilePath()))
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
