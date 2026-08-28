import type {
  ExportDocumentPayload,
  ExportDocumentResult,
  OpenFileResult,
  OpenFolderResult,
  ReadImageResult,
  SaveFilePayload,
  SaveFileResult,
  SavePastedImagePayload,
  SavePastedImageResult,
} from '@shared/file-types'
import type { AppError } from '@shared/errors'
import type { Result } from '@shared/result'

export interface ElectronAPI {
  platform: string
  getVersion: () => Promise<Result<string, AppError>>
  setDirty: (isDirty: boolean) => void
  confirmClose: (decision: 'proceed' | 'cancel') => void
  onRequestClose: (callback: () => void) => () => void
  openFile: () => Promise<Result<OpenFileResult, AppError>>
  openFolder: () => Promise<Result<OpenFolderResult, AppError>>
  readFile: (filePath: string) => Promise<Result<OpenFileResult, AppError>>
  readImage: (filePath: string) => Promise<Result<ReadImageResult, AppError>>
  saveFile: (payload: SaveFilePayload) => Promise<Result<SaveFileResult, AppError>>
  saveFileAs: (payload: SaveFilePayload) => Promise<Result<SaveFileResult, AppError>>
  savePastedImage: (
    payload: SavePastedImagePayload,
  ) => Promise<Result<SavePastedImageResult, AppError>>
  exportHtml: (payload: ExportDocumentPayload) => Promise<Result<ExportDocumentResult, AppError>>
  exportPdf: (payload: ExportDocumentPayload) => Promise<Result<ExportDocumentResult, AppError>>
  updateTitle: (payload: { filePath?: string; isDirty: boolean }) => void
  quit: () => void
}
