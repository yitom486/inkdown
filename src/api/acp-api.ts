import type { AppError } from '@shared/core/errors'
import { err, ok, type Result } from '@shared/core/result'
import type { ElectronAPI } from '@shared/ipc/electron-api.types'
import type {
  AcpCancelPayload,
  AcpConnectPayload,
  AcpConnectResult,
  AcpPermissionRequestEvent,
  AcpPermissionResponsePayload,
  AcpPromptPayload,
  AcpPromptResult,
  AcpRuntimeInfo,
  AcpSessionNewPayload,
  AcpSessionNewResult,
  AcpSessionUpdateEvent,
  AcpStatusChangedEvent,
} from '@shared/types/acp'

function requireElectronAPI(): Result<ElectronAPI, AppError> {
  if (!window.electronAPI) {
    return err({
      code: 'API_UNAVAILABLE',
      message: 'Electron API 不可用，请重启应用后重试',
    })
  }
  return ok(window.electronAPI)
}

export const acpApi = {
  async listRuntimes(): Promise<Result<AcpRuntimeInfo[], AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.listAcpRuntimes()
  },

  async connect(payload: AcpConnectPayload): Promise<Result<AcpConnectResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.acpConnect(payload)
  },

  async disconnect(): Promise<Result<void, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.acpDisconnect()
  },

  async sessionNew(payload: AcpSessionNewPayload): Promise<Result<AcpSessionNewResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.acpSessionNew(payload)
  },

  async prompt(payload: AcpPromptPayload): Promise<Result<AcpPromptResult, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.acpPrompt(payload)
  },

  async cancel(payload: AcpCancelPayload): Promise<Result<void, AppError>> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    return api.value.acpCancel(payload)
  },

  respondPermission(payload: AcpPermissionResponsePayload): Result<void, AppError> {
    const api = requireElectronAPI()
    if (!api.ok) return api
    api.value.acpRespondPermission(payload)
    return ok(undefined)
  },

  onSessionUpdate(callback: (event: AcpSessionUpdateEvent) => void): () => void {
    if (!window.electronAPI) return () => undefined
    return window.electronAPI.onAcpSessionUpdate(callback)
  },

  onStatusChanged(callback: (event: AcpStatusChangedEvent) => void): () => void {
    if (!window.electronAPI) return () => undefined
    return window.electronAPI.onAcpStatusChanged(callback)
  },

  onPermissionRequest(
    callback: (event: AcpPermissionRequestEvent & { summary?: string }) => void,
  ): () => void {
    if (!window.electronAPI) return () => undefined
    return window.electronAPI.onAcpPermissionRequest(callback)
  },
}
