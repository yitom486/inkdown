import type { AppError } from '@shared/errors'
import type {
  OpenFileResult,
  OpenFolderResult,
  ReadImageResult,
  SaveFilePayload,
  SaveFileResult,
} from '@shared/file-types'
import { err, ok, type Result } from '@shared/result'
import type { ElectronAPI } from '@shared/electron-api.types'

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
  async openFile(): Promise<Result<OpenFileResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.openFile()
  },

  async openFolder(): Promise<Result<OpenFolderResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.openFolder()
  },

  async readFile(filePath: string): Promise<Result<OpenFileResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.readFile(filePath)
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
