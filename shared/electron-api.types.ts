import type {
  OpenFileResult,
  OpenFolderResult,
  SaveFilePayload,
  SaveFileResult,
} from '@shared/file-types'

export interface ElectronAPI {
  platform: string
  getVersion: () => Promise<string>
  openFile: () => Promise<OpenFileResult | null>
  openFolder: () => Promise<OpenFolderResult | null>
  readFile: (filePath: string) => Promise<OpenFileResult>
  saveFile: (payload: SaveFilePayload) => Promise<SaveFileResult | null>
  saveFileAs: (payload: SaveFilePayload) => Promise<SaveFileResult | null>
  updateTitle: (payload: { filePath?: string; isDirty: boolean }) => void
  quit: () => void
}
