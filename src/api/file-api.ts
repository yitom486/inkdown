import type { AppError } from '@shared/core/errors'
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
import { err, ok, type Result } from '@shared/core/result'
import type { ElectronAPI } from '@shared/ipc/electron-api.types'

function requireElectronAPI(): Result<ElectronAPI, AppError> {
  if (!window.electronAPI) {
    return err({
      code: 'API_UNAVAILABLE',
      message: 'Electron API 不可用，请重启应用后重试',
    })
  }

  return ok(window.electronAPI)
}

export const fileApi = {
  async openFile(options?: OpenDialogOptions): Promise<Result<OpenDocumentResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.openFile(options)
  },

  async openFolder(options?: OpenDialogOptions): Promise<Result<OpenFolderResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.openFolder(options)
  },

  async scanWorkspace(rootPath: string): Promise<Result<OpenFolderResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.scanWorkspace(rootPath)
  },

  async readFile(filePath: string): Promise<Result<OpenFileResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.readFile(filePath)
  },

  async readBinaryFile(filePath: string): Promise<Result<ReadBinaryResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.readBinaryFile(filePath)
  },

  async readImage(filePath: string): Promise<Result<ReadImageResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.readImage(filePath)
  },

  async saveFile(payload: SaveFilePayload): Promise<Result<SaveFileResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.saveFile(payload)
  },

  async saveFileAs(payload: SaveFilePayload): Promise<Result<SaveFileResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.saveFileAs(payload)
  },

  async savePastedImage(
    payload: SavePastedImagePayload,
  ): Promise<Result<SavePastedImageResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.savePastedImage(payload)
  },

  async exportHtml(
    payload: ExportDocumentPayload,
  ): Promise<Result<ExportDocumentResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.exportHtml(payload)
  },

  async exportPdf(payload: ExportDocumentPayload): Promise<Result<ExportDocumentResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.exportPdf(payload)
  },
}

export const appApi = {
  async getVersion(): Promise<Result<string, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.getVersion()
  },

  getPlatform(): Result<string, AppError> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return ok(api.value.platform)
  },
}
