import type { RendererErrorPayload } from '@shared/error-log-types'
import { ok, type Result } from '@shared/result'
import type { AppError } from '@shared/errors'

function getElectronAPI() {
  return typeof window !== 'undefined' ? window.electronAPI : undefined
}

export const appApi = {
  toggleDevTools(): void {
    getElectronAPI()?.toggleDevTools()
  },

  async logRendererError(payload: RendererErrorPayload): Promise<void> {
    const api = getElectronAPI()
    if (!api) return
    await api.logRendererError(payload)
  },

  async getErrorLogPath(): Promise<Result<string, AppError>> {
    const api = getElectronAPI()
    if (!api) {
      return ok('')
    }
    return api.getErrorLogPath()
  },

  setVerboseLogs(enabled: boolean): void {
    getElectronAPI()?.setVerboseLogs(enabled)
  },
}
