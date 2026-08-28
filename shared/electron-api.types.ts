import type {
  ExportDocumentPayload,
  ExportDocumentResult,
  OpenDialogOptions,
  OpenDocumentResult,
  OpenFileResult,
  OpenFolderResult,
  ReadBinaryResult,
  ReadImageResult,
  SaveFilePayload,
  SaveFileResult,
  SavePastedImagePayload,
  SavePastedImageResult,
} from '@shared/file-types'
import type { AppError } from '@shared/errors'
import type { RendererErrorPayload } from '@shared/error-log-types'
import type { Result } from '@shared/result'

export interface ElectronAPI {
  platform: string
  getVersion: () => Promise<Result<string, AppError>>
  setDirty: (isDirty: boolean) => void
  confirmClose: (decision: 'proceed' | 'cancel') => void
  onRequestClose: (callback: () => void) => () => void
  openFile: (options?: OpenDialogOptions) => Promise<Result<OpenDocumentResult, AppError>>
  openFolder: (options?: OpenDialogOptions) => Promise<Result<OpenFolderResult, AppError>>
  scanWorkspace: (rootPath: string) => Promise<Result<OpenFolderResult, AppError>>
  readFile: (filePath: string) => Promise<Result<OpenFileResult, AppError>>
  readBinaryFile: (filePath: string) => Promise<Result<ReadBinaryResult, AppError>>
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
  toggleDevTools: () => void
  logRendererError: (payload: RendererErrorPayload) => Promise<Result<string, AppError>>
  getErrorLogPath: () => Promise<Result<string, AppError>>
  setVerboseLogs: (enabled: boolean) => void
}
