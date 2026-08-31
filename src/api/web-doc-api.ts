import type {
  WebDocDiscoverTocPayload,
  WebDocDiscoverTocResult,
  WebDocFetchPayload,
  WebDocFetchResult,
} from '@shared/types/web-doc'
import type { AppError } from '@shared/core/errors'
import type { Result } from '@shared/core/result'
import type { ElectronAPI } from '@shared/ipc/electron-api.types'
import { err } from '@shared/core/result'

function requireElectronAPI(): Result<ElectronAPI, AppError> {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (!api?.fetchWebDocPage || !api.discoverWebDocToc) {
    return err({
      code: 'API_UNAVAILABLE',
      message: '在线文档 API 不可用（请重启应用以加载最新 preload）',
    })
  }
  return { ok: true, value: api }
}

export const webDocApi = {
  async fetchPage(payload: WebDocFetchPayload): Promise<Result<WebDocFetchResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.fetchWebDocPage(payload)
  },

  async discoverToc(
    payload: WebDocDiscoverTocPayload,
  ): Promise<Result<WebDocDiscoverTocResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.discoverWebDocToc(payload)
  },
}
