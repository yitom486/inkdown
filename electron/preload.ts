import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  OpenFileResult,
  OpenFolderResult,
  SaveFilePayload,
  SaveFileResult,
} from '../shared/file-types'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_GET_VERSION),
  openFile: (): Promise<OpenFileResult | null> =>
    ipcRenderer.invoke(IPC.FILE_OPEN),
  openFolder: (): Promise<OpenFolderResult | null> =>
    ipcRenderer.invoke(IPC.FILE_OPEN_FOLDER),
  readFile: (filePath: string): Promise<OpenFileResult> =>
    ipcRenderer.invoke(IPC.FILE_READ, filePath),
  saveFile: (payload: SaveFilePayload): Promise<SaveFileResult | null> =>
    ipcRenderer.invoke(IPC.FILE_SAVE, payload),
  saveFileAs: (payload: SaveFilePayload): Promise<SaveFileResult | null> =>
    ipcRenderer.invoke(IPC.FILE_SAVE_AS, payload),
  updateTitle: (payload: { filePath?: string; isDirty: boolean }): void => {
    ipcRenderer.send(IPC.FILE_UPDATE_TITLE, payload)
  },
  quit: (): void => {
    ipcRenderer.send(IPC.APP_QUIT)
  },
})
