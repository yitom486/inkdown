/** ACP 跨进程 DTO（精简，不嵌入完整协议 schema） */

import type {
  InkdownSnapshotArgs,
  InkdownSnapshotResource,
} from '@shared/agent/inkdown-snapshot'

export type AcpConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'awaiting_auth'
  | 'connected'
  | 'error'

export interface AcpRuntimeInfo {
  id: string
  name: string
  description: string
  /** 启动命令（如 bunx） */
  command: string
  args: string[]
  /** 文档用：需要的环境变量名 */
  requiredEnvKeys: string[]
}

export interface AcpConnectPayload {
  runtimeId: string
  /** 覆盖默认 cwd；缺省用 process.cwd() */
  cwd?: string
  /**
   * 当前聊天线程关联的 Agent sessionId。
   * 若 Agent 支持 resume/load，连接时优先恢复，避免重连后失忆。
   */
  resumeSessionId?: string
}

export interface AcpAuthMethod {
  id: string
  name?: string
  description?: string
  /** chatgpt | api_key | terminal | … */
  type?: string
}

export type AcpSessionRestoreMethod = 'resume' | 'load' | 'new'

export interface AcpSessionRestoreAttempt {
  method: 'resume' | 'load'
  ok: boolean
  /** 重试次数（含首次，至少为 1） */
  tries: number
  error?: string
}

export interface AcpPromptCapabilities {
  /** Agent 是否接受 ContentBlock.image */
  image?: boolean
  audio?: boolean
  embeddedContext?: boolean
}

/** session/prompt 的 ContentBlock（Client → Agent） */
export type AcpContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'resource_link'
      uri: string
      name: string
      mimeType?: string
      size?: number
    }
  | {
      type: 'image'
      data: string
      mimeType: string
      uri?: string
    }

export interface AcpConnectReadyResult {
  phase: 'ready'
  runtimeId: string
  sessionId: string
  protocolVersion: number
  agentName?: string
  agentVersion?: string
  configOptions?: AcpConfigOption[]
  loadSessionSupported?: boolean
  resumeSessionSupported?: boolean
  promptCapabilities?: AcpPromptCapabilities
  /** 是否成功恢复到请求的旧 session */
  sessionRestored?: boolean
  restoreMethod?: AcpSessionRestoreMethod
  /** 本想恢复的旧 id（若有） */
  requestedSessionId?: string
  /** resume/load 尝试明细（便于 UI / 日志） */
  restoreAttempts?: AcpSessionRestoreAttempt[]
}

export interface AcpConnectNeedsAuthResult {
  phase: 'needs_auth'
  runtimeId: string
  protocolVersion: number
  agentName?: string
  agentVersion?: string
  authMethods: AcpAuthMethod[]
  loadSessionSupported?: boolean
  resumeSessionSupported?: boolean
  promptCapabilities?: AcpPromptCapabilities
}

export type AcpConnectResult = AcpConnectReadyResult | AcpConnectNeedsAuthResult

export interface AcpAuthenticatePayload {
  methodId: string
}

export interface AcpLoadSessionPayload {
  sessionId: string
  cwd: string
}

export interface AcpConfigOptionValue {
  value: string
  name: string
  description?: string
}

export interface AcpConfigOption {
  configId: string
  name: string
  description?: string
  category?: string
  type: 'select' | 'boolean' | string
  currentValue?: string | boolean
  options?: AcpConfigOptionValue[]
}

export interface AcpSetConfigOptionPayload {
  sessionId: string
  configId: string
  value: string | boolean
}

export interface AcpSetConfigOptionResult {
  configOptions: AcpConfigOption[]
}

export interface AcpSessionNewPayload {
  /** 缺省时用当前已连接 Agent 的工作区 */
  cwd?: string
}

export interface AcpSessionNewResult {
  sessionId: string
  configOptions?: AcpConfigOption[]
}

export interface AcpPromptPayload {
  sessionId: string
  prompt: AcpContentBlock[]
}

export interface AcpPromptResult {
  stopReason: string
}

export interface AcpCancelPayload {
  sessionId: string
}

/** ACP tool_call / tool_call_update 状态 */
export type AcpToolCallStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | string

/** ACP tool kind（用于图标与文案） */
export type AcpToolCallKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'other'
  | string

/** 透传 session/update 的 update 对象，渲染端按 sessionUpdate 分支 */
export interface AcpSessionUpdateEvent {
  sessionId: string
  update: Record<string, unknown>
}

export interface AcpStatusChangedEvent {
  status: AcpConnectionStatus
  runtimeId?: string
  sessionId?: string | null
  errorMessage?: string
}

export interface AcpPermissionRequestEvent {
  requestId: number
  sessionId?: string
  toolCall?: Record<string, unknown>
  options?: unknown[]
  rawParams: Record<string, unknown>
  /** 主进程整理的摘要标题，便于 UI 展示 */
  summary?: string
}

export type AcpPermissionOutcome =
  | { outcome: 'selected'; optionId: string }
  | { outcome: 'cancelled' }

export interface AcpPermissionResponsePayload {
  requestId: number
  outcome: AcpPermissionOutcome
}

/** 主进程向渲染进程索取 Inkdown 内存快照 */
export interface AcpSnapshotRequestEvent {
  requestId: number
  resource: InkdownSnapshotResource
  args?: InkdownSnapshotArgs
}

export type AcpSnapshotResponsePayload =
  | { requestId: number; ok: true; content: string }
  | { requestId: number; ok: false; message: string }

/** 本机 Codex 登录态粗检（无密钥内容） */
export interface AcpAuthPreflightResult {
  codexHome: string
  hasCodexHome: boolean
  hasAuthFile: boolean
  hasApiKeyEnv: boolean
  looksLoggedIn: boolean
}
