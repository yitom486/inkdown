import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { OpenFileResult, SaveFilePayload, SaveFileResult } from '../shared/file-types'

function subscribe(channel: string, callback: () => void): () => void {
  const listener = (): void => callback()
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_GET_VERSION),
  onShowAbout: (callback: () => void): (() => void) =>
    subscribe(IPC.APP_SHOW_ABOUT, callback),
  openFile: (): Promise<OpenFileResult | null> =>
    ipcRenderer.invoke(IPC.FILE_OPEN),
  saveFile: (payload: SaveFilePayload): Promise<SaveFileResult | null> =>
    ipcRenderer.invoke(IPC.FILE_SAVE, payload),
  saveFileAs: (payload: SaveFilePayload): Promise<SaveFileResult | null> =>
    ipcRenderer.invoke(IPC.FILE_SAVE_AS, payload),
  onMenuOpen: (callback: () => void): (() => void) =>
    subscribe(IPC.FILE_MENU_OPEN, callback),
  onMenuSave: (callback: () => void): (() => void) =>
    subscribe(IPC.FILE_MENU_SAVE, callback),
  onMenuSaveAs: (callback: () => void): (() => void) =>
    subscribe(IPC.FILE_MENU_SAVE_AS, callback),
  updateTitle: (payload: { filePath?: string; isDirty: boolean }): void => {
    ipcRenderer.send(IPC.FILE_UPDATE_TITLE, payload)
  },
})
