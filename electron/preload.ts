import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { ExportDocumentPayload, SaveFilePayload, SavePastedImagePayload } from '@shared/file-types'
import type { ElectronAPI } from '@shared/electron-api.types'

const electronAPI: ElectronAPI = {
  platform: process.platform,
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
  openFile: () => ipcRenderer.invoke(IPC.FILE_OPEN),
  openFolder: () => ipcRenderer.invoke(IPC.FILE_OPEN_FOLDER),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC.FILE_READ, filePath),
  readImage: (filePath: string) => ipcRenderer.invoke(IPC.FILE_READ_IMAGE, filePath),
  saveFile: (payload: SaveFilePayload) => ipcRenderer.invoke(IPC.FILE_SAVE, payload),
  saveFileAs: (payload: SaveFilePayload) => ipcRenderer.invoke(IPC.FILE_SAVE_AS, payload),
  savePastedImage: (payload: SavePastedImagePayload) =>
    ipcRenderer.invoke(IPC.FILE_SAVE_PASTED_IMAGE, payload),
  exportHtml: (payload: ExportDocumentPayload) =>
    ipcRenderer.invoke(IPC.FILE_EXPORT_HTML, payload),
  exportPdf: (payload: ExportDocumentPayload) => ipcRenderer.invoke(IPC.FILE_EXPORT_PDF, payload),
  updateTitle: (payload) => {
    ipcRenderer.send(IPC.FILE_UPDATE_TITLE, payload)
  },
  quit: () => {
    ipcRenderer.send(IPC.APP_QUIT)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
