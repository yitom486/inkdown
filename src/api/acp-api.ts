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
  AcpSetConfigOptionPayload,
  AcpSetConfigOptionResult,
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

/** preload 未热更新时，旧 electronAPI 缺少 ACP 方法；避免 TypeError 炸整页 */
function hasAcpBridge(api: ElectronAPI): boolean {
  return (
    typeof api.onAcpPermissionRequest === 'function' &&
    typeof api.onAcpSessionUpdate === 'function' &&
    typeof api.onAcpStatusChanged === 'function' &&
    typeof api.acpConnect === 'function'
  )
}

function requireAcpBridge(): Result<ElectronAPI, AppError> {
  const api = requireElectronAPI()
  if (!api.ok) return api
  if (!hasAcpBridge(api.value)) {
    return err({
      code: 'API_UNAVAILABLE',
      message: 'ACP 桥接未就绪（请完全重启 bun run dev，勿仅刷新页面）',
    })
  }
  return api
}

export const acpApi = {
  async listRuntimes(): Promise<Result<AcpRuntimeInfo[], AppError>> {
    const api = requireAcpBridge()
    if (!api.ok) return api
    return api.value.listAcpRuntimes()
  },

  async connect(payload: AcpConnectPayload): Promise<Result<AcpConnectResult, AppError>> {
    const api = requireAcpBridge()
    if (!api.ok) return api
    return api.value.acpConnect(payload)
  },

  async disconnect(): Promise<Result<void, AppError>> {
    const api = requireAcpBridge()
    if (!api.ok) return api
    return api.value.acpDisconnect()
  },

  async sessionNew(payload: AcpSessionNewPayload): Promise<Result<AcpSessionNewResult, AppError>> {
    const api = requireAcpBridge()
    if (!api.ok) return api
    return api.value.acpSessionNew(payload)
  },

  async prompt(payload: AcpPromptPayload): Promise<Result<AcpPromptResult, AppError>> {
    const api = requireAcpBridge()
    if (!api.ok) return api
    return api.value.acpPrompt(payload)
  },

  async cancel(payload: AcpCancelPayload): Promise<Result<void, AppError>> {
    const api = requireAcpBridge()
    if (!api.ok) return api
    return api.value.acpCancel(payload)
  },

  async setConfigOption(
    payload: AcpSetConfigOptionPayload,
  ): Promise<Result<AcpSetConfigOptionResult, AppError>> {
    const api = requireAcpBridge()
    if (!api.ok) return api
    return api.value.acpSetConfigOption(payload)
  },

  respondPermission(payload: AcpPermissionResponsePayload): Result<void, AppError> {
    const api = requireAcpBridge()
    if (!api.ok) return api
    api.value.acpRespondPermission(payload)
    return ok(undefined)
  },

  onSessionUpdate(callback: (event: AcpSessionUpdateEvent) => void): () => void {
    const api = requireAcpBridge()
    if (!api.ok) return () => undefined
    return api.value.onAcpSessionUpdate(callback)
  },

  onStatusChanged(callback: (event: AcpStatusChangedEvent) => void): () => void {
    const api = requireAcpBridge()
    if (!api.ok) return () => undefined
    return api.value.onAcpStatusChanged(callback)
  },

  onPermissionRequest(
    callback: (event: AcpPermissionRequestEvent & { summary?: string }) => void,
  ): () => void {
    const api = requireAcpBridge()
    if (!api.ok) return () => undefined
    return api.value.onAcpPermissionRequest(callback)
  },
}
