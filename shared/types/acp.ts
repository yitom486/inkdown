/**
 * ACP 跨进程 DTO（精简，不嵌入完整协议 schema）。
 *
 * 设计要点：
 * - 只放 Inkdown IPC / UI 真正用到的字段；Agent 多出来的键进 Record 透传，避免每次协议小改就改类型。
 * - 用判别联合（phase / outcome / ok / type）让 UI 用 switch 收窄，不要用布尔「又成功又要登录」。
 * - cwd 一律可选：有工作区就用用户目录，没有就主进程沙箱 cwd（纯阅读场景）。
 */

import type {
  InkdownSnapshotArgs,
  InkdownSnapshotResource,
} from '@shared/agent/inkdown-snapshot'

/** 主进程单例连接状态；UI 按钮/指示灯跟这个走 */
export type AcpConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'awaiting_auth'
  | 'connected'
  | 'error'

/** 可启动的 Agent 运行时（来自 agent-registry，不是一次 RPC 结果） */
export interface AcpRuntimeInfo {
  /** 如 codex-acp，connect 时用这个选运行时 */
  id: string
  name: string
  description: string
  /** 启动命令（如 bunx） */
  command: string
  args: string[]
  /** 文档用：需要的环境变量名（不包含密钥值） */
  requiredEnvKeys: string[]
}

/** 渲染进程请求连接；真正 spawn 在主进程 */
export interface AcpConnectPayload {
  /** 对应 AcpRuntimeInfo.id */
  runtimeId: string
  /** 用户工作区；缺省时主进程使用应用沙箱目录（网页阅读等无文件夹场景） */
  cwd?: string
  /**
   * 当前聊天线程关联的 Agent sessionId。
   * 若 Agent 支持 resume/load，连接时优先恢复，避免重连后失忆。
   */
  resumeSessionId?: string
}

/** Agent initialize 声明的登录方式；id 交给后续 authenticate */
export interface AcpAuthMethod {
  /** authenticate 时回传的 methodId */
  id: string
  name?: string
  description?: string
  /** chatgpt | api_key | terminal | … */
  type?: string
}

/** 这次连上后 session 是怎么来的 */
export type AcpSessionRestoreMethod = 'resume' | 'load' | 'new'

/** 单次 resume/load 尝试，给日志和「为何变成新会话」 */
export interface AcpSessionRestoreAttempt {
  method: 'resume' | 'load'
  ok: boolean
  /** 重试次数（含首次，至少为 1） */
  tries: number
  error?: string
}

/** Agent 声明 prompt 能吃哪些 ContentBlock；UI 据此藏掉不支持的附件 */
export interface AcpPromptCapabilities {
  /** Agent 是否接受 ContentBlock.image */
  image?: boolean
  audio?: boolean
  /** 是否接受嵌入式上下文块 */
  embeddedContext?: boolean
}

/**
 * session/prompt 的一块内容（Client → Agent）。
 * 用 type 判别：文本 / 资源链接 / 图片，对应协议 ContentBlock，不是自由 JSON。
 */
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
      /** base64，不含 data: 前缀 */
      data: string
      mimeType: string
      uri?: string
    }

/** 连接成功且已有可用 session，可以 prompt */
export interface AcpConnectReadyResult {
  phase: 'ready'
  runtimeId: string
  /** 此后 prompt/cancel 都带这个 id */
  sessionId: string
  protocolVersion: number
  agentName?: string
  agentVersion?: string
  configOptions?: AcpConfigOption[]
  /** Agent 是否声明 session/load */
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

/** 进程已起、协议已握手，但必须先 authenticate，还没有可 prompt 的 session */
export interface AcpConnectNeedsAuthResult {
  phase: 'needs_auth'
  runtimeId: string
  protocolVersion: number
  agentName?: string
  agentVersion?: string
  /** 给登录 UI 列方式；选中的 id 走 authenticate */
  authMethods: AcpAuthMethod[]
  loadSessionSupported?: boolean
  resumeSessionSupported?: boolean
  promptCapabilities?: AcpPromptCapabilities
}

/** 用 phase 区分「能聊了」和「先登录」；不要做成可选 sessionId */
export type AcpConnectResult = AcpConnectReadyResult | AcpConnectNeedsAuthResult

export interface AcpAuthenticatePayload {
  /** 对应 AcpAuthMethod.id */
  methodId: string
}

export interface AcpLoadSessionPayload {
  /** 要加载的已有 ACP session */
  sessionId: string
  /** 用户工作区；缺省时主进程回落沙箱 cwd */
  cwd?: string
  /**
   * 批注等副会话：加载时不覆盖主面板 sessionId，并压制回放更新（本地已有气泡）。
   */
  secondary?: boolean
}

/** 下拉/开关里的一项可选值 */
export interface AcpConfigOptionValue {
  value: string
  name: string
  description?: string
}

/** Agent 的 Mode/Model 等配置项；形状跟协议走，type 留 string 以防未知种类 */
export interface AcpConfigOption {
  configId: string
  name: string
  description?: string
  category?: string
  type: 'select' | 'boolean' | string
  currentValue?: string | boolean
  /** type 为 select 时的候选项 */
  options?: AcpConfigOptionValue[]
}

export interface AcpSetConfigOptionPayload {
  sessionId: string
  configId: string
  value: string | boolean
}

/** 设置成功后回完整列表，避免 UI 自己拼 currentValue */
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
  /** 发到哪条 session；须与当前连接一致 */
  sessionId: string
  /** 一块或多块；空数组由主进程拒绝 */
  prompt: AcpContentBlock[]
}

/** prompt RPC 结束原因（end_turn 等）；流式正文不走这个结构，走 session/update */
export interface AcpPromptResult {
  /** 协议 stopReason，如 end_turn / cancelled */
  stopReason: string
}

export interface AcpCancelPayload {
  /** 要取消 prompt 的那条 ACP session */
  sessionId: string
}

/** ACP tool_call / tool_call_update 状态；| string 兼容 Agent 多出来的值 */
export type AcpToolCallStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | string

/** ACP tool kind（用于图标与文案）；| string 同上 */
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

/**
 * 一次 session/update 通知。
 * update 不做成大联合：种类多、Agent 常加字段；渲染端读 sessionUpdate 再分支。
 */
export interface AcpSessionUpdateEvent {
  /** 这条更新属于哪条 ACP session */
  sessionId: string
  /**
   * 协议里的 update 对象（含 sessionUpdate 种类字段）。
   * 不在类型里穷举，避免 Agent 加字段就改 DTO。
   */
  update: Record<string, unknown>
}

/** 主进程连接状态变化，广播给所有窗口的 Agent 面板 */
export interface AcpStatusChangedEvent {
  status: AcpConnectionStatus
  /** 当前运行时 id，断开后仍可能带上一次的 */
  runtimeId?: string
  /** 已连接时有值；断开可为 null */
  sessionId?: string | null
  /** status 为 error 时的说明 */
  errorMessage?: string
}

/** 主→渲染：请用户批一次工具调用；requestId 必须原样带回 */
export interface AcpPermissionRequestEvent {
  /** 与回复 payload 对齐，对不上会丢掉 */
  requestId: number
  sessionId?: string
  /** 工具调用摘要对象，结构随 Agent，故不做成固定 interface */
  toolCall?: Record<string, unknown>
  /** 允许/拒绝等选项，原样交给 UI */
  options?: unknown[]
  /** 完整权限 RPC params，调试或进阶 UI 用 */
  rawParams: Record<string, unknown>
  /** 主进程整理的摘要标题，便于 UI 展示 */
  summary?: string
}

/** 选了某个 optionId，或整单取消（超时无默认允许时也走 cancelled） */
export type AcpPermissionOutcome =
  | { outcome: 'selected'; optionId: string }
  | { outcome: 'cancelled' }

export interface AcpPermissionResponsePayload {
  /** 必须等于对应请求的 requestId */
  requestId: number
  outcome: AcpPermissionOutcome
}

/** 主进程向渲染进程索取 Inkdown 内存快照 */
export interface AcpSnapshotRequestEvent {
  requestId: number
  /** 要哪一类快照（当前文档、目录等） */
  resource: InkdownSnapshotResource
  args?: InkdownSnapshotArgs
}

/** 用 ok 判别成功/失败，避免 content 与 message 同时可选对不齐 */
export type AcpSnapshotResponsePayload =
  | { requestId: number; ok: true; content: string }
  | { requestId: number; ok: false; message: string }

/** 本机 Codex 登录态粗检（无密钥内容） */
export interface AcpAuthPreflightResult {
  /** 解析到的 CODEX_HOME / 默认 ~/.codex */
  codexHome: string
  hasCodexHome: boolean
  hasAuthFile: boolean
  hasApiKeyEnv: boolean
  /** 有 auth 文件或 API Key 环境变量即视为粗略已登录 */
  looksLoggedIn: boolean
}

/** ACP tool_call / tool_call_update 状态；| string 兼容 Agent 多出来的值 */
export type AcpToolCallStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | string

/** ACP tool kind（用于图标与文案）；| string 同上 */
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

/**
 * 一次 session/update 通知。
 * update 不做成大联合：种类多、Agent 常加字段；渲染端读 sessionUpdate 再分支。
 */
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

/** 主→渲染：请用户批一次工具调用；requestId 必须原样带回 */
export interface AcpPermissionRequestEvent {
  requestId: number
  sessionId?: string
  toolCall?: Record<string, unknown>
  options?: unknown[]
  rawParams: Record<string, unknown>
  /** 主进程整理的摘要标题，便于 UI 展示 */
  summary?: string
}

/** 选了某个 optionId，或整单取消（超时无默认允许时也走 cancelled） */
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

/** 用 ok 判别成功/失败，避免 content 与 message 同时可选对不齐 */
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
