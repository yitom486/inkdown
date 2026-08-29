import { app, BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type {
  ExportDocumentPayload,
  OpenDialogOptions,
  SaveFilePayload,
  SavePastedImagePayload,
} from '@shared/types/file'
import type { RendererErrorPayload } from '@shared/types/error-log'
import type {
  CreateReadingMarkPayload,
  UpdateReadingMarkPayload,
} from '@shared/types/reading-mark'
import type {
  AcpCancelPayload,
  AcpConnectPayload,
  AcpPermissionResponsePayload,
  AcpPromptPayload,
  AcpSessionNewPayload,
  AcpSetConfigOptionPayload,
} from '@shared/types/acp'
import { ok } from '@shared/core/result'
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
} from '../services/file-service'
import { getAppVersion } from '../services/app-service'
import { appendRendererErrorLog, getErrorLogFilePath } from '../services/error-log-service'
import { createWindow, getWindowInitByWebContents } from '../window/create-window'
import { applyWindowTitle } from '../window/window-title'
import { setVerboseRendererLogs } from '../services/runtime-state'
import {
  createReadingMark,
  deleteReadingMark,
  listReadingMarks,
  updateReadingMark,
} from '../services/reading-marks-service'
import { getWindowSessionByWebContents } from '../window/window-session'
import { setWorkspaceWatch, stopWorkspaceWatch } from '../services/workspace-watcher'
import { listAcpRuntimes } from '../services/acp/agent-registry'
import {
  cancelAcp,
  connectAcp,
  createAcpSession,
  disconnectAcp,
  onAcpSessionUpdate,
  onAcpStatusChanged,
  promptAcp,
  setAcpConfigOption,
  setAcpPermissionBridge,
} from '../services/acp/acp-client'
import { pickAllowOptionId } from '../services/acp/client-handlers'

function broadcastToAllWindows(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

/** 集中注册 IPC；文件/书签等耗时操作均为 async，不阻塞主进程事件循环 */
export function registerIpcHandlers(): void {
  setAcpPermissionBridge(async ({ requestId, sessionId, params }) => {
    const toolCall = params.toolCall
    const title =
      toolCall && typeof toolCall === 'object' && 'title' in toolCall
        ? String((toolCall as { title?: unknown }).title ?? '工具调用')
        : '工具调用'

    broadcastToAllWindows(IPC.ACP_PERMISSION_REQUEST, {
      requestId,
      sessionId,
      toolCall:
        toolCall && typeof toolCall === 'object'
          ? (toolCall as Record<string, unknown>)
          : undefined,
      options: Array.isArray(params.options) ? params.options : undefined,
      rawParams: params,
      summary: title,
    })

    return await new Promise((resolve) => {
      const timer = setTimeout(() => {
        cleanup()
        const allowId = pickAllowOptionId(params)
        if (allowId) resolve({ outcome: 'selected', optionId: allowId })
        else resolve({ outcome: 'cancelled' })
      }, 120_000)

      const handler = (
        _event: Electron.IpcMainEvent,
        payload: AcpPermissionResponsePayload,
      ): void => {
        if (payload?.requestId !== requestId) return
        cleanup()
        resolve(payload.outcome)
      }

      const cleanup = (): void => {
        clearTimeout(timer)
        ipcMain.removeListener(IPC.ACP_PERMISSION_RESPONSE, handler)
      }

      ipcMain.on(IPC.ACP_PERMISSION_RESPONSE, handler)
    })
  })

  onAcpSessionUpdate((event) => {
    broadcastToAllWindows(IPC.ACP_SESSION_UPDATE, event)
  })

  onAcpStatusChanged((event) => {
    broadcastToAllWindows(IPC.ACP_STATUS_CHANGED, event)
  })

  ipcMain.handle(IPC.ACP_LIST_RUNTIMES, () => ok(listAcpRuntimes()))
  ipcMain.handle(IPC.ACP_CONNECT, (_event, payload: AcpConnectPayload) => connectAcp(payload))
  ipcMain.handle(IPC.ACP_DISCONNECT, () => disconnectAcp())
  ipcMain.handle(IPC.ACP_SESSION_NEW, (_event, payload: AcpSessionNewPayload) =>
    createAcpSession(payload.cwd),
  )
  ipcMain.handle(IPC.ACP_PROMPT, (_event, payload: AcpPromptPayload) => promptAcp(payload))
  ipcMain.handle(IPC.ACP_CANCEL, (_event, payload: AcpCancelPayload) => cancelAcp(payload))
  ipcMain.handle(IPC.ACP_SET_CONFIG_OPTION, (_event, payload: AcpSetConfigOptionPayload) =>
    setAcpConfigOption(payload),
  )

  ipcMain.handle(IPC.APP_GET_VERSION, () => getAppVersion())

  ipcMain.on(IPC.APP_SET_DIRTY, (event, isDirty: boolean) => {
    const session = getWindowSessionByWebContents(event.sender)
    if (session) session.documentDirty = isDirty
  })

  ipcMain.on(IPC.APP_CLOSE_DECISION, (event, decision: 'proceed' | 'cancel') => {
    getWindowSessionByWebContents(event.sender)?.closeController.handleRendererCloseDecision(
      decision,
    )
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

  ipcMain.on(IPC.WORKSPACE_WATCH, (event, rootPath: string) => {
    if (typeof rootPath !== 'string' || rootPath.length === 0) return
    setWorkspaceWatch(event.sender, rootPath)
  })

  ipcMain.on(IPC.WORKSPACE_UNWATCH, (event) => {
    stopWorkspaceWatch(event.sender.id)
  })
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

  ipcMain.on(IPC.FILE_UPDATE_TITLE, (event, payload: { filePath?: string; isDirty: boolean }) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender)
    if (targetWindow && !targetWindow.isDestroyed()) {
      applyWindowTitle(targetWindow, payload.filePath, payload.isDirty)
    }
  })

  ipcMain.on(IPC.APP_QUIT, () => {
    app.quit()
  })

  ipcMain.on(IPC.APP_NEW_WINDOW, () => {
    createWindow({ fresh: true })
  })

  /** preload 启动时同步读取，仅访问内存中的 session 映射 */
  ipcMain.on(IPC.APP_GET_WINDOW_INIT, (event) => {
    event.returnValue = getWindowInitByWebContents(event.sender)
  })

  ipcMain.on(IPC.APP_TOGGLE_DEVTOOLS, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.webContents.toggleDevTools()
  })

  ipcMain.on(IPC.APP_SET_VERBOSE_LOGS, (_event, enabled: boolean) => {
    setVerboseRendererLogs(enabled)
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

  ipcMain.handle(IPC.MARKS_LIST, (_event, filePath: string) => listReadingMarks(filePath))
  ipcMain.handle(IPC.MARKS_CREATE, (_event, payload: CreateReadingMarkPayload) =>
    createReadingMark(payload),
  )
  ipcMain.handle(IPC.MARKS_UPDATE, (_event, payload: UpdateReadingMarkPayload) =>
    updateReadingMark(payload),
  )
  ipcMain.handle(IPC.MARKS_DELETE, (_event, id: string) => deleteReadingMark(id))
}
