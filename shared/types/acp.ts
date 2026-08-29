/** ACP 跨进程 DTO（精简，不嵌入完整协议 schema） */

export type AcpConnectionStatus =
  | 'disconnected'
  | 'connecting'
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
}

export interface AcpConnectResult {
  runtimeId: string
  sessionId: string
  protocolVersion: number
  agentName?: string
  agentVersion?: string
  configOptions?: AcpConfigOption[]
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
  cwd: string
}

export interface AcpSessionNewResult {
  sessionId: string
  configOptions?: AcpConfigOption[]
}

export interface AcpPromptPayload {
  sessionId: string
  text: string
}

export interface AcpPromptResult {
  stopReason: string
}

export interface AcpCancelPayload {
  sessionId: string
}

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
}

export type AcpPermissionOutcome =
  | { outcome: 'selected'; optionId: string }
  | { outcome: 'cancelled' }

export interface AcpPermissionResponsePayload {
  requestId: number
  outcome: AcpPermissionOutcome
}
