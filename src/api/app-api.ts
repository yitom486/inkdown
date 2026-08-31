import type { RendererErrorPayload } from '@shared/types/error-log'
import type { AppUpdateStatus } from '@shared/types/app-update'
import { ok, err, isOk, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'

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

  newWindow(): void {
    getElectronAPI()?.newWindow()
  },

  async openExternal(url: string): Promise<Result<void, AppError>> {
    const api = getElectronAPI()
    if (!api?.openExternal) {
      return err({ code: 'API_UNAVAILABLE', message: '外部链接 API 不可用' })
    }
    return api.openExternal(url)
  },

  async checkAppUpdate(): Promise<AppUpdateStatus | null> {
    const api = getElectronAPI()
    if (!api?.checkAppUpdate) return null
    return api.checkAppUpdate()
  },

  async downloadAppUpdate(): Promise<AppUpdateStatus | null> {
    const api = getElectronAPI()
    if (!api?.downloadAppUpdate) return null
    return api.downloadAppUpdate()
  },

  async installAppUpdate(): Promise<Result<void, AppError>> {
    const api = getElectronAPI()
    if (!api?.installAppUpdate) {
      return err({ code: 'API_UNAVAILABLE', message: '更新 API 不可用' })
    }
    return api.installAppUpdate()
  },

  async getAppUpdateStatus(): Promise<AppUpdateStatus | null> {
    const api = getElectronAPI()
    if (!api?.getAppUpdateStatus) return null
    const result = await api.getAppUpdateStatus()
    return isOk(result) ? result.value : null
  },

  onAppUpdateStatus(callback: (status: AppUpdateStatus) => void): (() => void) | undefined {
    return getElectronAPI()?.onAppUpdateStatus(callback)
  },
}
