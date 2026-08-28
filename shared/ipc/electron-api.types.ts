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
} from '@shared/types/file'
import type { AppError } from '@shared/core/errors'
import type { RendererErrorPayload } from '@shared/types/error-log'
import type { Result } from '@shared/core/result'
import type {
  CreateReadingMarkPayload,
  ReadingMark,
  UpdateReadingMarkPayload,
} from '@shared/types/reading-mark'

export interface ElectronAPI {
  platform: string
  /** 通过「新建窗口」打开时为 true，不恢复工作区/上次文件 */
  isFreshWindow: boolean
  getVersion: () => Promise<Result<string, AppError>>
  setDirty: (isDirty: boolean) => void
  confirmClose: (decision: 'proceed' | 'cancel') => void
  onRequestClose: (callback: () => void) => () => void
  openFile: (options?: OpenDialogOptions) => Promise<Result<OpenDocumentResult, AppError>>
  openFolder: (options?: OpenDialogOptions) => Promise<Result<OpenFolderResult, AppError>>
  scanWorkspace: (rootPath: string) => Promise<Result<OpenFolderResult, AppError>>
  watchWorkspace: (rootPath: string) => void
  unwatchWorkspace: () => void
  onWorkspaceChanged: (callback: (payload: { rootPath: string }) => void) => () => void
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
  newWindow: () => void
  toggleDevTools: () => void
  logRendererError: (payload: RendererErrorPayload) => Promise<Result<string, AppError>>
  getErrorLogPath: () => Promise<Result<string, AppError>>
  setVerboseLogs: (enabled: boolean) => void
  listReadingMarks: (filePath: string) => Promise<Result<ReadingMark[], AppError>>
  createReadingMark: (payload: CreateReadingMarkPayload) => Promise<Result<ReadingMark, AppError>>
  updateReadingMark: (payload: UpdateReadingMarkPayload) => Promise<Result<ReadingMark, AppError>>
  deleteReadingMark: (id: string) => Promise<Result<void, AppError>>
}
