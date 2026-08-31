import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type {
  ExportDocumentPayload,
  ExportMarkdownPayload,
  OpenDialogOptions,
  SaveFilePayload,
  SavePastedImagePayload,
  WorkspaceFsCopyPayload,
  WorkspaceFsCreateDirPayload,
  WorkspaceFsCreateFilePayload,
  WorkspaceFsDeletePayload,
  WorkspaceFsMovePayload,
  WorkspaceFsRenamePayload,
} from '@shared/types/file'
import type { RendererErrorPayload } from '@shared/types/error-log'
import type {
  CreateReadingMarkPayload,
  UpdateReadingMarkPayload,
} from '@shared/types/reading-mark'
import type {
  AcpAuthenticatePayload,
  AcpCancelPayload,
  AcpConnectPayload,
  AcpLoadSessionPayload,
  AcpPermissionResponsePayload,
  AcpPromptPayload,
  AcpSessionNewPayload,
  AcpSetConfigOptionPayload,
  AcpSnapshotResponsePayload,
} from '@shared/types/acp'
import type { WebDocDiscoverTocPayload, WebDocFetchPayload } from '@shared/types/web-doc'
import { ok, err } from '@shared/core/result'
import {
  exportHtmlDocument,
  exportPdfDocument,
  exportMarkdownDocument,
  openDocumentDialog,
  openFolderDialog,
  scanWorkspaceFolder,
  readBinaryFileByPath,
  readFileByPath,
  readImageAsDataUrl,
  saveFileDialog,
  savePastedImage,
} from '../services/file-service'
import {
  workspaceCopy,
  workspaceCreateDirectory,
  workspaceCreateFile,
  workspaceDelete,
  workspaceMove,
  workspaceRename,
} from '../services/workspace-fs'
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
import {
  discoverWebDocToc,
  fetchWebDocPage,
  parseWebDocUrlInput,
} from '../services/web-doc-service'
import { getWindowSessionByWebContents } from '../window/window-session'
import { setWorkspaceWatch, stopWorkspaceWatch } from '../services/workspace-watcher'
import { listAcpRuntimes } from '../services/acp/agent-registry'
import { probeCodexAuth } from '../services/acp/codex-auth-preflight'
import {
  authenticateAcp,
  cancelAcp,
  connectAcp,
  createAcpSession,
  disconnectAcp,
  loadAcpSession,
  onAcpSessionUpdate,
  onAcpStatusChanged,
  promptAcp,
  setAcpConfigOption,
  setAcpPermissionBridge,
  setAcpSnapshotBridge,
} from '../services/acp/acp-client'
import { pickAllowOptionId } from '../services/acp/client-handlers'

function broadcastToAllWindows(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

/**
 * ACP 是全局单例，但快照必须来自「发起这轮对话的那个窗口」，
 * 否则多窗口同目录时会拿到别的窗口正在读的书。
 */
let agentOwnerWebContentsId: number | null = null

function rememberAgentOwner(sender: Electron.WebContents): void {
  agentOwnerWebContentsId = sender.id
}

function resolveAgentOwnerWebContents(): Electron.WebContents | null {
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed())
  const owner = windows.find((win) => win.webContents.id === agentOwnerWebContentsId)
  if (owner) return owner.webContents
  // 发起窗口已关闭：退回聚焦窗口，再退回任意窗口
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && !focused.isDestroyed()) return focused.webContents
  return windows[0]?.webContents ?? null
}

/** 快照全部来自渲染进程内存，正常应在毫秒级返回 */
const ACP_SNAPSHOT_TIMEOUT_MS = 5_000

/** 集中注册 IPC；文件/书签等耗时操作均为 async，不阻塞主进程事件循环 */
export function registerIpcHandlers(): void {
  setAcpPermissionBridge(async ({ requestId, sessionId, params }) => {
    const toolCall = params.toolCall
    const title =
      toolCall && typeof toolCall === 'object' && 'title' in toolCall
        ? String((toolCall as { title?: unknown }).title ?? '工具调用')
        : '工具调用'

    console.info('[acp] 广播权限请求到渲染进程', {
      requestId,
      sessionId,
      summary: title,
      optionCount: Array.isArray(params.options) ? params.options.length : 0,
    })

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
        console.warn('[acp] 权限请求 120s 超时，自动决议', {
          requestId,
          allowId,
        })
        if (allowId) resolve({ outcome: 'selected', optionId: allowId })
        else resolve({ outcome: 'cancelled' })
      }, 120_000)

      const handler = (
        _event: Electron.IpcMainEvent,
        payload: AcpPermissionResponsePayload,
      ): void => {
        if (payload?.requestId !== requestId) return
        cleanup()
        console.info('[acp] 收到渲染进程权限响应', payload)
        resolve(payload.outcome)
      }

      const cleanup = (): void => {
        clearTimeout(timer)
        ipcMain.removeListener(IPC.ACP_PERMISSION_RESPONSE, handler)
      }

      ipcMain.on(IPC.ACP_PERMISSION_RESPONSE, handler)
    })
  })

  setAcpSnapshotBridge(async ({ requestId, resource, args }) => {
    const target = resolveAgentOwnerWebContents()
    if (!target) {
      throw new Error('没有可用窗口提供 Inkdown 快照')
    }
    target.send(IPC.ACP_SNAPSHOT_REQUEST, { requestId, resource, args })

    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Inkdown 快照请求超时：${resource}`))
      }, ACP_SNAPSHOT_TIMEOUT_MS)

      const handler = (
        _event: Electron.IpcMainEvent,
        payload: AcpSnapshotResponsePayload,
      ): void => {
        if (payload?.requestId !== requestId) return
        cleanup()
        if (payload.ok) resolve(payload.content)
        else reject(new Error(payload.message))
      }

      const cleanup = (): void => {
        clearTimeout(timer)
        ipcMain.removeListener(IPC.ACP_SNAPSHOT_RESPONSE, handler)
      }

      ipcMain.on(IPC.ACP_SNAPSHOT_RESPONSE, handler)
    })
  })

  onAcpSessionUpdate((event) => {
    broadcastToAllWindows(IPC.ACP_SESSION_UPDATE, event)
  })

  onAcpStatusChanged((event) => {
    broadcastToAllWindows(IPC.ACP_STATUS_CHANGED, event)
  })

  ipcMain.handle(IPC.ACP_LIST_RUNTIMES, () => ok(listAcpRuntimes()))
  ipcMain.handle(IPC.ACP_AUTH_PREFLIGHT, () => ok(probeCodexAuth()))
  ipcMain.handle(IPC.ACP_CONNECT, (event, payload: AcpConnectPayload) => {
    rememberAgentOwner(event.sender)
    return connectAcp(payload)
  })
  ipcMain.handle(IPC.ACP_AUTHENTICATE, (_event, payload: AcpAuthenticatePayload) =>
    authenticateAcp(payload),
  )
  ipcMain.handle(IPC.ACP_LOAD_SESSION, (_event, payload: AcpLoadSessionPayload) =>
    loadAcpSession({
      sessionId: payload.sessionId,
      cwd: payload.cwd,
      secondary: payload.secondary,
    }),
  )
  ipcMain.handle(IPC.ACP_DISCONNECT, () => disconnectAcp())
  ipcMain.handle(IPC.ACP_SESSION_NEW, (_event, payload: AcpSessionNewPayload) =>
    createAcpSession(payload?.cwd),
  )
  ipcMain.handle(IPC.ACP_PROMPT, (event, payload: AcpPromptPayload) => {
    rememberAgentOwner(event.sender)
    return promptAcp(payload)
  })
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
  ipcMain.handle(IPC.FILE_CREATE, (_event, payload: WorkspaceFsCreateFilePayload) =>
    workspaceCreateFile(payload),
  )
  ipcMain.handle(IPC.FILE_CREATE_DIR, (_event, payload: WorkspaceFsCreateDirPayload) =>
    workspaceCreateDirectory(payload),
  )
  ipcMain.handle(IPC.FILE_RENAME, (_event, payload: WorkspaceFsRenamePayload) =>
    workspaceRename(payload),
  )
  ipcMain.handle(IPC.FILE_DELETE, (_event, payload: WorkspaceFsDeletePayload) =>
    workspaceDelete(payload),
  )
  ipcMain.handle(IPC.FILE_COPY, (_event, payload: WorkspaceFsCopyPayload) =>
    workspaceCopy(payload),
  )
  ipcMain.handle(IPC.FILE_MOVE, (_event, payload: WorkspaceFsMovePayload) =>
    workspaceMove(payload),
  )
  ipcMain.handle(IPC.FILE_EXPORT_HTML, (_event, payload: ExportDocumentPayload) =>
    exportHtmlDocument(payload),
  )
  ipcMain.handle(IPC.FILE_EXPORT_PDF, (_event, payload: ExportDocumentPayload) =>
    exportPdfDocument(payload),
  )
  ipcMain.handle(IPC.FILE_EXPORT_MARKDOWN, (_event, payload: ExportMarkdownPayload) =>
    exportMarkdownDocument(payload),
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

  ipcMain.handle(IPC.APP_OPEN_EXTERNAL, async (_event, rawUrl: unknown) => {
    const urlResult = parseWebDocUrlInput(rawUrl)
    if (!urlResult.ok) return urlResult
    try {
      await shell.openExternal(urlResult.value)
      return ok(undefined)
    } catch (cause) {
      return err({
        code: 'UNKNOWN',
        message: cause instanceof Error ? cause.message : '无法打开外部链接',
      })
    }
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

  ipcMain.handle(IPC.WEB_DOC_FETCH_PAGE, async (_event, payload: WebDocFetchPayload) => {
    const urlResult = parseWebDocUrlInput(payload?.url)
    if (!urlResult.ok) return urlResult
    return fetchWebDocPage({ url: urlResult.value })
  })

  ipcMain.handle(IPC.WEB_DOC_DISCOVER_TOC, async (_event, payload: WebDocDiscoverTocPayload) => {
    const urlResult = parseWebDocUrlInput(payload?.url)
    if (!urlResult.ok) return urlResult
    return discoverWebDocToc({ url: urlResult.value })
  })
}
