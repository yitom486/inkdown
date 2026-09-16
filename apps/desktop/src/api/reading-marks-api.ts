import type {
  CreateReadingMarkPayload,
  ReadingMark,
  UpdateReadingMarkPayload,
} from '@inkdown/contracts'
import type { AppError } from '@inkdown/contracts'
import { err, ok, type Result } from '@inkdown/contracts'

function requireElectronAPI() {
  if (!window.electronAPI) {
    return err({
      code: 'API_UNAVAILABLE' as const,
      message: 'Electron API 不可用',
    })
  }
  return ok(window.electronAPI)
}

export const readingMarksApi = {
  async list(filePath: string): Promise<Result<ReadingMark[], AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.listReadingMarks(filePath)
  },

  async create(payload: CreateReadingMarkPayload): Promise<Result<ReadingMark, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.createReadingMark(payload)
  },

  async update(payload: UpdateReadingMarkPayload): Promise<Result<ReadingMark, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.updateReadingMark(payload)
  },

  async remove(id: string): Promise<Result<void, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.deleteReadingMark(id)
  },
}
