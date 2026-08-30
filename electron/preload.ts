import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { ExportDocumentPayload, OpenDialogOptions, SaveFilePayload, SavePastedImagePayload } from '@shared/types/file'
import type { RendererErrorPayload } from '@shared/types/error-log'
import type { WindowInit } from '@shared/types/window'
import type { ElectronAPI } from '@shared/ipc/electron-api.types'

const windowInit = ipcRenderer.sendSync(IPC.APP_GET_WINDOW_INIT) as WindowInit
const isFreshWindow = windowInit?.isFreshWindow ?? false

const electronAPI: ElectronAPI = {
  platform: process.platform,
  isFreshWindow,
  getVersion: () => ipcRenderer.invoke(IPC.APP_GET_VERSION),
  setDirty: (isDirty: boolean) => {
    ipcRenderer.send(IPC.APP_SET_DIRTY, isDirty)
  },
  confirmClose: (decision: 'proceed' | 'cancel') => {
    ipcRenderer.send(IPC.APP_CLOSE_DECISION, decision)
  },
  onRequestClose: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on(IPC.APP_REQUEST_CLOSE, handler)
    return () => {
      ipcRenderer.removeListener(IPC.APP_REQUEST_CLOSE, handler)
    }
  },
  openFile: (options?: OpenDialogOptions) => ipcRenderer.invoke(IPC.FILE_OPEN, options),
  openFolder: (options?: OpenDialogOptions) => ipcRenderer.invoke(IPC.FILE_OPEN_FOLDER, options),
  scanWorkspace: (rootPath: string) => ipcRenderer.invoke(IPC.FILE_SCAN_WORKSPACE, rootPath),
  watchWorkspace: (rootPath: string) => {
    ipcRenderer.send(IPC.WORKSPACE_WATCH, rootPath)
  },
  unwatchWorkspace: () => {
    ipcRenderer.send(IPC.WORKSPACE_UNWATCH)
  },
  onWorkspaceChanged: (callback: (payload: { rootPath: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { rootPath: string }) => {
      callback(payload)
    }
    ipcRenderer.on(IPC.WORKSPACE_CHANGED, handler)
    return () => {
      ipcRenderer.removeListener(IPC.WORKSPACE_CHANGED, handler)
    }
  },
  readFile: (filePath: string) => ipcRenderer.invoke(IPC.FILE_READ, filePath),
  readBinaryFile: (filePath: string) => ipcRenderer.invoke(IPC.FILE_READ_BINARY, filePath),
  readImage: (filePath: string) => ipcRenderer.invoke(IPC.FILE_READ_IMAGE, filePath),
  saveFile: (payload: SaveFilePayload) => ipcRenderer.invoke(IPC.FILE_SAVE, payload),
  saveFileAs: (payload: SaveFilePayload) => ipcRenderer.invoke(IPC.FILE_SAVE_AS, payload),
  savePastedImage: (payload: SavePastedImagePayload) =>
    ipcRenderer.invoke(IPC.FILE_SAVE_PASTED_IMAGE, payload),
  createWorkspaceFile: (payload) => ipcRenderer.invoke(IPC.FILE_CREATE, payload),
  createWorkspaceDirectory: (payload) => ipcRenderer.invoke(IPC.FILE_CREATE_DIR, payload),
  renameWorkspacePath: (payload) => ipcRenderer.invoke(IPC.FILE_RENAME, payload),
  deleteWorkspacePath: (payload) => ipcRenderer.invoke(IPC.FILE_DELETE, payload),
  copyWorkspacePath: (payload) => ipcRenderer.invoke(IPC.FILE_COPY, payload),
  moveWorkspacePath: (payload) => ipcRenderer.invoke(IPC.FILE_MOVE, payload),
  exportHtml: (payload: ExportDocumentPayload) =>
    ipcRenderer.invoke(IPC.FILE_EXPORT_HTML, payload),
  exportPdf: (payload: ExportDocumentPayload) => ipcRenderer.invoke(IPC.FILE_EXPORT_PDF, payload),
  updateTitle: (payload) => {
    ipcRenderer.send(IPC.FILE_UPDATE_TITLE, payload)
  },
  quit: () => {
    ipcRenderer.send(IPC.APP_QUIT)
  },
  newWindow: () => {
    ipcRenderer.send(IPC.APP_NEW_WINDOW)
  },
  toggleDevTools: () => {
    ipcRenderer.send(IPC.APP_TOGGLE_DEVTOOLS)
  },
  logRendererError: (payload: RendererErrorPayload) =>
    ipcRenderer.invoke(IPC.APP_LOG_RENDERER_ERROR, payload),
  getErrorLogPath: () => ipcRenderer.invoke(IPC.APP_GET_ERROR_LOG_PATH),
  setVerboseLogs: (enabled: boolean) => {
    ipcRenderer.send(IPC.APP_SET_VERBOSE_LOGS, enabled)
  },
  listReadingMarks: (filePath: string) => ipcRenderer.invoke(IPC.MARKS_LIST, filePath),
  createReadingMark: (payload) => ipcRenderer.invoke(IPC.MARKS_CREATE, payload),
  updateReadingMark: (payload) => ipcRenderer.invoke(IPC.MARKS_UPDATE, payload),
  deleteReadingMark: (id: string) => ipcRenderer.invoke(IPC.MARKS_DELETE, id),
  listAcpRuntimes: () => ipcRenderer.invoke(IPC.ACP_LIST_RUNTIMES),
  acpAuthPreflight: () => ipcRenderer.invoke(IPC.ACP_AUTH_PREFLIGHT),
  acpConnect: (payload) => ipcRenderer.invoke(IPC.ACP_CONNECT, payload),
  acpAuthenticate: (payload) => ipcRenderer.invoke(IPC.ACP_AUTHENTICATE, payload),
  acpLoadSession: (payload) => ipcRenderer.invoke(IPC.ACP_LOAD_SESSION, payload),
  acpDisconnect: () => ipcRenderer.invoke(IPC.ACP_DISCONNECT),
  acpSessionNew: (payload) => ipcRenderer.invoke(IPC.ACP_SESSION_NEW, payload),
  acpPrompt: (payload) => ipcRenderer.invoke(IPC.ACP_PROMPT, payload),
  acpCancel: (payload) => ipcRenderer.invoke(IPC.ACP_CANCEL, payload),
  acpSetConfigOption: (payload) => ipcRenderer.invoke(IPC.ACP_SET_CONFIG_OPTION, payload),
  acpRespondPermission: (payload) => {
    ipcRenderer.send(IPC.ACP_PERMISSION_RESPONSE, payload)
  },
  acpRespondSnapshot: (payload) => {
    ipcRenderer.send(IPC.ACP_SNAPSHOT_RESPONSE, payload)
  },
  onAcpSessionUpdate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) => {
      callback(payload)
    }
    ipcRenderer.on(IPC.ACP_SESSION_UPDATE, handler)
    return () => {
      ipcRenderer.removeListener(IPC.ACP_SESSION_UPDATE, handler)
    }
  },
  onAcpStatusChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) => {
      callback(payload)
    }
    ipcRenderer.on(IPC.ACP_STATUS_CHANGED, handler)
    return () => {
      ipcRenderer.removeListener(IPC.ACP_STATUS_CHANGED, handler)
    }
  },
  onAcpPermissionRequest: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) => {
      callback(payload)
    }
    ipcRenderer.on(IPC.ACP_PERMISSION_REQUEST, handler)
    return () => {
      ipcRenderer.removeListener(IPC.ACP_PERMISSION_REQUEST, handler)
    }
  },
  onAcpSnapshotRequest: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) => {
      callback(payload)
    }
    ipcRenderer.on(IPC.ACP_SNAPSHOT_REQUEST, handler)
    return () => {
      ipcRenderer.removeListener(IPC.ACP_SNAPSHOT_REQUEST, handler)
    }
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
