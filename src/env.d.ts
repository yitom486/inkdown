import type { OpenFileResult, SaveFilePayload, SaveFileResult } from '../../shared/file-types'

export interface ElectronAPI {
  platform: NodeJS.Platform
  getVersion: () => Promise<string>
  onShowAbout: (callback: () => void) => () => void
  openFile: () => Promise<OpenFileResult | null>
  saveFile: (payload: SaveFilePayload) => Promise<SaveFileResult | null>
  saveFileAs: (payload: SaveFilePayload) => Promise<SaveFileResult | null>
  onMenuOpen: (callback: () => void) => () => void
  onMenuSave: (callback: () => void) => () => void
  onMenuSaveAs: (callback: () => void) => () => void
  updateTitle: (payload: { filePath?: string; isDirty: boolean }) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
