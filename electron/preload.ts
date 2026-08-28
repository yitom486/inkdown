import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { SaveFilePayload } from '@shared/file-types'
import type { ElectronAPI } from '@shared/electron-api.types'

const electronAPI: ElectronAPI = {
  platform: process.platform,
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_GET_VERSION),
  openFile: () => ipcRenderer.invoke(IPC.FILE_OPEN),
  openFolder: () => ipcRenderer.invoke(IPC.FILE_OPEN_FOLDER),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC.FILE_READ, filePath),
  saveFile: (payload: SaveFilePayload) => ipcRenderer.invoke(IPC.FILE_SAVE, payload),
  saveFileAs: (payload: SaveFilePayload) => ipcRenderer.invoke(IPC.FILE_SAVE_AS, payload),
  updateTitle: (payload) => {
    ipcRenderer.send(IPC.FILE_UPDATE_TITLE, payload)
  },
  quit: () => {
    ipcRenderer.send(IPC.APP_QUIT)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
