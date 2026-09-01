import type {
  ExportDocumentPayload,
  ExportDocumentResult,
  ExportMarkdownPayload,
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
  WorkspaceFsCopyPayload,
  WorkspaceFsCreateDirPayload,
  WorkspaceFsCreateFilePayload,
  WorkspaceFsDeletePayload,
  WorkspaceFsMovePayload,
  WorkspaceFsPathResult,
  WorkspaceFsRenamePayload,
} from '@shared/types/file'
import type { AppError } from '@shared/core/errors'
import type { RendererErrorPayload } from '@shared/types/error-log'
import type { Result } from '@shared/core/result'
import type {
  CreateReadingMarkPayload,
  ReadingMark,
  UpdateReadingMarkPayload,
} from '@shared/types/reading-mark'
import type {
  AcpAuthPreflightResult,
  AcpAuthenticatePayload,
  AcpCancelPayload,
  AcpConnectPayload,
  AcpConnectResult,
  AcpLoadSessionPayload,
  AcpPermissionRequestEvent,
  AcpPermissionResponsePayload,
  AcpSnapshotRequestEvent,
  AcpSnapshotResponsePayload,
  AcpPromptPayload,
  AcpPromptResult,
  AcpRuntimeInfo,
  AcpSessionNewPayload,
  AcpSessionNewResult,
  AcpSessionUpdateEvent,
  AcpSetConfigOptionPayload,
  AcpSetConfigOptionResult,
  AcpStatusChangedEvent,
} from '@shared/types/acp'
import type {
  WebDocDiscoverTocPayload,
  WebDocDiscoverTocResult,
  WebDocFetchPayload,
  WebDocFetchResult,
} from '@shared/types/web-doc'
import type {
  GetPdfOcrTocPayload,
  PdfOcrTocCache,
  RecognizePdfTocPayload,
} from '@shared/types/ocr'
import type { AppUpdateStatus } from '@shared/types/app-update'

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
  createWorkspaceFile: (
    payload: WorkspaceFsCreateFilePayload,
  ) => Promise<Result<WorkspaceFsPathResult, AppError>>
  createWorkspaceDirectory: (
    payload: WorkspaceFsCreateDirPayload,
  ) => Promise<Result<WorkspaceFsPathResult, AppError>>
  renameWorkspacePath: (
    payload: WorkspaceFsRenamePayload,
  ) => Promise<Result<WorkspaceFsPathResult, AppError>>
  deleteWorkspacePath: (payload: WorkspaceFsDeletePayload) => Promise<Result<void, AppError>>
  copyWorkspacePath: (
    payload: WorkspaceFsCopyPayload,
  ) => Promise<Result<WorkspaceFsPathResult, AppError>>
  moveWorkspacePath: (
    payload: WorkspaceFsMovePayload,
  ) => Promise<Result<WorkspaceFsPathResult, AppError>>
  exportHtml: (payload: ExportDocumentPayload) => Promise<Result<ExportDocumentResult, AppError>>
  exportPdf: (payload: ExportDocumentPayload) => Promise<Result<ExportDocumentResult, AppError>>
  exportMarkdown: (payload: ExportMarkdownPayload) => Promise<Result<ExportDocumentResult, AppError>>
  updateTitle: (payload: { filePath?: string; isDirty: boolean }) => void
  quit: () => void
  newWindow: () => void
  openExternal: (url: string) => Promise<Result<void, AppError>>
  toggleDevTools: () => void
  logRendererError: (payload: RendererErrorPayload) => Promise<Result<string, AppError>>
  getErrorLogPath: () => Promise<Result<string, AppError>>
  setVerboseLogs: (enabled: boolean) => void
  listReadingMarks: (filePath: string) => Promise<Result<ReadingMark[], AppError>>
  createReadingMark: (payload: CreateReadingMarkPayload) => Promise<Result<ReadingMark, AppError>>
  updateReadingMark: (payload: UpdateReadingMarkPayload) => Promise<Result<ReadingMark, AppError>>
  deleteReadingMark: (id: string) => Promise<Result<void, AppError>>
  listAcpRuntimes: () => Promise<Result<AcpRuntimeInfo[], AppError>>
  acpAuthPreflight: () => Promise<Result<AcpAuthPreflightResult, AppError>>
  acpConnect: (payload: AcpConnectPayload) => Promise<Result<AcpConnectResult, AppError>>
  acpAuthenticate: (
    payload: AcpAuthenticatePayload,
  ) => Promise<Result<Extract<AcpConnectResult, { phase: 'ready' }>, AppError>>
  acpLoadSession: (
    payload: AcpLoadSessionPayload,
  ) => Promise<Result<AcpSessionNewResult, AppError>>
  acpDisconnect: () => Promise<Result<void, AppError>>
  acpSessionNew: (payload: AcpSessionNewPayload) => Promise<Result<AcpSessionNewResult, AppError>>
  acpPrompt: (payload: AcpPromptPayload) => Promise<Result<AcpPromptResult, AppError>>
  acpCancel: (payload: AcpCancelPayload) => Promise<Result<void, AppError>>
  acpSetConfigOption: (
    payload: AcpSetConfigOptionPayload,
  ) => Promise<Result<AcpSetConfigOptionResult, AppError>>
  acpRespondPermission: (payload: AcpPermissionResponsePayload) => void
  acpRespondSnapshot: (payload: AcpSnapshotResponsePayload) => void
  onAcpSessionUpdate: (callback: (event: AcpSessionUpdateEvent) => void) => () => void
  onAcpStatusChanged: (callback: (event: AcpStatusChangedEvent) => void) => () => void
  onAcpPermissionRequest: (
    callback: (event: AcpPermissionRequestEvent & { summary?: string }) => void,
  ) => () => void
  onAcpSnapshotRequest: (callback: (event: AcpSnapshotRequestEvent) => void) => () => void
  fetchWebDocPage: (payload: WebDocFetchPayload) => Promise<Result<WebDocFetchResult, AppError>>
  discoverWebDocToc: (
    payload: WebDocDiscoverTocPayload,
  ) => Promise<Result<WebDocDiscoverTocResult, AppError>>
  getPdfOcrToc: (
    payload: GetPdfOcrTocPayload,
  ) => Promise<Result<PdfOcrTocCache, AppError>>
  recognizePdfOcrToc: (
    payload: RecognizePdfTocPayload,
  ) => Promise<Result<PdfOcrTocCache, AppError>>
  deletePdfOcrToc: (payload: GetPdfOcrTocPayload) => Promise<Result<void, AppError>>
  checkAppUpdate: () => Promise<AppUpdateStatus>
  downloadAppUpdate: () => Promise<AppUpdateStatus>
  installAppUpdate: () => Promise<Result<void, AppError>>
  getAppUpdateStatus: () => Promise<Result<AppUpdateStatus, AppError>>
  onAppUpdateStatus: (callback: (status: AppUpdateStatus) => void) => () => void
}
