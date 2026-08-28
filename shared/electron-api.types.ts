import type {
  OpenFileResult,
  OpenFolderResult,
  SaveFilePayload,
  SaveFileResult,
} from '@shared/file-types'
import type { AppError } from '@shared/errors'
import type { Result } from '@shared/result'

export interface ElectronAPI {
  platform: string
  getVersion: () => Promise<string>
  openFile: () => Promise<Result<OpenFileResult, AppError>>
  openFolder: () => Promise<Result<OpenFolderResult, AppError>>
  readFile: (filePath: string) => Promise<Result<OpenFileResult, AppError>>
  saveFile: (payload: SaveFilePayload) => Promise<Result<SaveFileResult, AppError>>
  saveFileAs: (payload: SaveFilePayload) => Promise<Result<SaveFileResult, AppError>>
  updateTitle: (payload: { filePath?: string; isDirty: boolean }) => void
  quit: () => void
}
