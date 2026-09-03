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
import { resolveSnapshotTimeoutMs } from '@shared/agent/inkdown-snapshot'
import type {
  GetPdfOcrTocPayload,
  GetPdfOcrPagePayload,
  ListPdfOcrPagesPayload,
  RecognizePdfPagePayload,
  RecognizePdfTocPayload,
  SavePdfOcrTocPayload,
} from '@shared/types/ocr'
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
import { installBunRuntime, probeBunRuntime } from '../services/bun-runtime'
import {
  checkAppUpdate,
  downloadAppUpdate,
  getAppUpdateStatus,
  installAppUpdate,
} from '../services/app-updater'
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
import { readPdfOcrTocCache, deletePdfOcrTocCache, clearAllPdfOcrCaches, writePdfOcrTocCache } from '../services/ocr/ocr-toc-cache'
import {
  deleteAllPdfOcrPageCaches,
  listPdfOcrPageCachePages,
  readPdfOcrPageCache,
} from '../services/ocr/ocr-page-cache'
import { recognizePdfPage } from '../services/ocr/pdf-page-ocr-service'
import { recognizePdfToc } from '../services/ocr/pdf-ocr-toc-service'
import {
  cancelOcrComponentDownload,
  ensureOcrComponent,
  inspectOcrComponentStatus,
} from '../services/ocr/ocr-component-manager'
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

/**
 * 应用还在运行时，把同一条 IPC 推到每一扇还活着的窗。
 * 用于 ACP 全局单例：连接状态、流式 session/update、权限框（各窗 UI 都要同步）。
 * 不是退出时杀进程；已销毁的窗必须跳过，否则 send 会抛错。
 */
function broadcastToAllWindows(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

/**
 * 最后一次 ACP connect / prompt 来自哪扇窗的 webContents.id。
 * 快照（当前打开的书/编辑器正文）只存在于渲染进程，必须问对窗口。
 */
let agentOwnerWebContentsId: number | null = null

/** 把 IPC 的 event.sender 记为 Agent 归属窗（后写覆盖先写） */
function rememberAgentOwner(sender: Electron.WebContents): void {
  agentOwnerWebContentsId = sender.id
}

/**
 * 解析快照该发给谁。顺序：
 * 1. 记下的 owner 还在 → 用它（正常路径）
 * 2. 那扇窗已关 → 当前聚焦窗
 * 3. 再没有 → 任意一扇还活着的窗（兜底，内容可能已不是当初那本书）
 * 4. 一个窗都没有 → null，调用方应失败而不是空发
 */
function resolveAgentOwnerWebContents(): Electron.WebContents | null {
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed())
  const owner = windows.find((win) => win.webContents.id === agentOwnerWebContentsId)
  if (owner) return owner.webContents
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && !focused.isDestroyed()) return focused.webContents
  return windows[0]?.webContents ?? null
}

/** 集中注册 IPC；文件/书签等耗时操作均为 async，不阻塞主进程事件循环 */
export function registerIpcHandlers(): void {
  // --- ACP：权限/快照桥（须先于 handle，Agent 回调才能找到窗口） ---
  // Agent 要跑工具时主进程拦下来，把选项交给 UI，等用户点允许/拒绝后再继续。
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

    // 单例 Agent：每扇窗都可能开着面板，权限框目前广播（任一窗用同一 requestId 回复即可）
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
      // 无人点按钮时不能让 Agent 永远挂起；有默认允许项则选它，否则当取消
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

  // 正文/阅读进度在渲染进程；只问 owner，避免多窗同目录时拍到别的书
  setAcpSnapshotBridge(async ({ requestId, resource, args }) => {
    const target = resolveAgentOwnerWebContents()
    if (!target) {
      throw new Error('没有可用窗口提供 Inkdown 快照')
    }
    target.send(IPC.ACP_SNAPSHOT_REQUEST, { requestId, resource, args })

    return await new Promise<string>((resolve, reject) => {
      // 快照来自渲染进程内存；可能触发 OCR 的资源用更长超时
      const timeoutMs = resolveSnapshotTimeoutMs(resource)
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Inkdown 快照请求超时：${resource}`))
      }, timeoutMs)

      const handler = (
        _event: Electron.IpcMainEvent,
        payload: AcpSnapshotResponsePayload,
      ): void => {
        if (payload?.requestId !== requestId) return
        cleanup()
        if (payload.ok) resolve(payload.content)
        else {
          console.warn('[acp] snapshot 渲染端失败', {
            requestId,
            resource,
            args,
            message: payload.message,
          })
          reject(new Error(payload.message))
        }
      }

      const cleanup = (): void => {
        clearTimeout(timer)
        ipcMain.removeListener(IPC.ACP_SNAPSHOT_RESPONSE, handler)
      }

      ipcMain.on(IPC.ACP_SNAPSHOT_RESPONSE, handler)
    })
  })

  // 流式输出 / 连接状态：全局一份 Agent，各窗面板要同一份数据
  onAcpSessionUpdate((event) => {
    broadcastToAllWindows(IPC.ACP_SESSION_UPDATE, event)
  })

  onAcpStatusChanged((event) => {
    broadcastToAllWindows(IPC.ACP_STATUS_CHANGED, event)
  })

  // --- ACP：连接、认证、session、prompt ---
  ipcMain.handle(IPC.ACP_LIST_RUNTIMES, () => ok(listAcpRuntimes()))
  ipcMain.handle(IPC.ACP_AUTH_PREFLIGHT, () => ok(probeCodexAuth()))
  ipcMain.handle(IPC.ACP_CONNECT, (event, payload: AcpConnectPayload) => {
    // 这扇窗之后的快照都问它
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
    // 换窗接着聊时，归属改到新的发起窗
    rememberAgentOwner(event.sender)
    return promptAcp(payload)
  })
  ipcMain.handle(IPC.ACP_CANCEL, (_event, payload: AcpCancelPayload) => cancelAcp(payload))
  ipcMain.handle(IPC.ACP_SET_CONFIG_OPTION, (_event, payload: AcpSetConfigOptionPayload) =>
    setAcpConfigOption(payload),
  )

  // --- 应用：版本与自动更新 ---
  ipcMain.handle(IPC.APP_GET_VERSION, () => getAppVersion())
  ipcMain.handle(IPC.APP_UPDATE_CHECK, () => checkAppUpdate())
  ipcMain.handle(IPC.APP_UPDATE_DOWNLOAD, () => downloadAppUpdate())
  ipcMain.handle(IPC.APP_UPDATE_INSTALL, () => {
    installAppUpdate()
    return ok(undefined)
  })
  ipcMain.handle(IPC.APP_UPDATE_GET_STATUS, () => ok(getAppUpdateStatus()))

  // --- 窗口：脏标记与关窗确认 ---
  ipcMain.on(IPC.APP_SET_DIRTY, (event, isDirty: boolean) => {
    const session = getWindowSessionByWebContents(event.sender)
    if (session) session.documentDirty = isDirty
  })

  ipcMain.on(IPC.APP_CLOSE_DECISION, (event, decision: 'proceed' | 'cancel') => {
    getWindowSessionByWebContents(event.sender)?.closeController.handleRendererCloseDecision(
      decision,
    )
  })

  // --- 文件 / 工作区：打开、读写、树操作、导出、监听 ---
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

  // --- 窗口 / 应用壳：标题、退出、新建窗、外链 ---
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

  // --- Bun 运行时（ACP 等子进程依赖） ---
  ipcMain.handle(IPC.BUN_GET_STATUS, async () => ok(await probeBunRuntime()))

  ipcMain.handle(IPC.BUN_INSTALL, async () => installBunRuntime())

  // --- 窗口初始化、DevTools、渲染进程错误日志 ---
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

  // --- 阅读书签 / 批注 ---
  ipcMain.handle(IPC.MARKS_LIST, (_event, filePath: string) => listReadingMarks(filePath))
  ipcMain.handle(IPC.MARKS_CREATE, (_event, payload: CreateReadingMarkPayload) =>
    createReadingMark(payload),
  )
  ipcMain.handle(IPC.MARKS_UPDATE, (_event, payload: UpdateReadingMarkPayload) =>
    updateReadingMark(payload),
  )
  ipcMain.handle(IPC.MARKS_DELETE, (_event, id: string) => deleteReadingMark(id))

  // --- 在线文档 ---
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

  // --- PDF OCR：缓存、识别、组件下载 ---
  ipcMain.handle(IPC.OCR_GET_PDF_TOC, async (_event, payload: GetPdfOcrTocPayload) => {
    const cache = await readPdfOcrTocCache(payload.fileFingerprint)
    return cache ? ok(cache) : err({ code: 'FILE_NOT_FOUND', message: '无 OCR 目录缓存' })
  })

  ipcMain.handle(IPC.OCR_RECOGNIZE_PDF_TOC, async (_event, payload: RecognizePdfTocPayload) =>
    recognizePdfToc(payload),
  )

  ipcMain.handle(IPC.OCR_DELETE_PDF_TOC, async (_event, payload: GetPdfOcrTocPayload) => {
    await deletePdfOcrTocCache(payload.fileFingerprint)
    return ok(undefined)
  })

  ipcMain.handle(IPC.OCR_GET_PDF_PAGE, async (_event, payload: GetPdfOcrPagePayload) => {
    const cache = await readPdfOcrPageCache(payload.fileFingerprint, payload.page)
    return cache ? ok(cache) : err({ code: 'FILE_NOT_FOUND', message: '本页尚无 OCR 缓存' })
  })

  ipcMain.handle(IPC.OCR_RECOGNIZE_PDF_PAGE, async (_event, payload: RecognizePdfPagePayload) =>
    recognizePdfPage(payload),
  )

  ipcMain.handle(IPC.OCR_LIST_PDF_PAGES, async (_event, payload: ListPdfOcrPagesPayload) =>
    ok(await listPdfOcrPageCachePages(payload.fileFingerprint)),
  )

  ipcMain.handle(IPC.OCR_CLEAR_PDF_CACHE, async (_event, payload: GetPdfOcrTocPayload) => {
    await Promise.all([
      deleteAllPdfOcrPageCaches(payload.fileFingerprint),
      deletePdfOcrTocCache(payload.fileFingerprint),
    ])
    return ok(undefined)
  })

  ipcMain.handle(IPC.OCR_CLEAR_ALL_CACHE, async () => {
    await clearAllPdfOcrCaches()
    return ok(undefined)
  })

  ipcMain.handle(IPC.OCR_SAVE_PDF_TOC, async (_event, payload: SavePdfOcrTocPayload) => {
    if (!payload?.cache?.fileFingerprint) {
      return err({ code: 'INVALID_ARGUMENT', message: '目录缓存无效' })
    }
    await writePdfOcrTocCache(payload.cache)
    return ok(undefined)
  })

  ipcMain.handle(IPC.OCR_GET_COMPONENT_STATUS, async () => ok(await inspectOcrComponentStatus()))

  ipcMain.handle(IPC.OCR_ENSURE_COMPONENT, async () => ensureOcrComponent())

  ipcMain.handle(IPC.OCR_CANCEL_COMPONENT_DOWNLOAD, async () =>
    ok(await cancelOcrComponentDownload()),
  )
}
