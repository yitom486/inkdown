import type {
  ClientApp,
  ClientConnection,
} from '@agentclientprotocol/sdk'
import type {
  AcpConnectionStatus,
  AcpPermissionOutcome,
  AcpPromptCapabilities,
  AcpSessionUpdateEvent,
  AcpStatusChangedEvent,
  InkdownSnapshotArgs,
  InkdownSnapshotResource,
} from '@inkdown/contracts'
import type { SdkStreamHandle } from './sdk-client'
import type { SpawnedAcpProcess } from './process-manager'
import type { InkdownMcpServerHandle } from './mcp/inkdown-mcp-server'
import { AcpTerminalManager } from './acp-terminal'

/** 协议版本（与 Agent initialize 握手协商一致，单点定义供 connection 读写） */
export const PROTOCOL_VERSION = 1

export type AcpSessionUpdateListener = (event: AcpSessionUpdateEvent) => void
export type AcpStatusListener = (event: AcpStatusChangedEvent) => void
export type AcpPermissionBridge = (payload: {
  requestId: number
  sessionId?: string
  params: Record<string, unknown>
}) => Promise<AcpPermissionOutcome>
export type AcpSnapshotBridge = (payload: {
  requestId: number
  resource: InkdownSnapshotResource
  args?: InkdownSnapshotArgs
}) => Promise<string>

/**
 * ACP 客户端单例状态（最底层模块，禁止 import ./acp-* 其他拆分模块，避免循环依赖）。
 * 原 `acp-client.ts` 顶层 `let` 全部收拢至此，connection / session-ops / bridges 经 `acpState` 读写。
 */
export const acpState: {
  sdkApp: ClientApp | null
  sdkConn: ClientConnection | null
  sdkStream: SdkStreamHandle | null
  terminalManager: AcpTerminalManager
  processHandle: SpawnedAcpProcess | null
  sessionId: string | null
  runtimeId: string | null
  workspaceRoot: string | null
  loadSessionSupported: boolean
  resumeSessionSupported: boolean
  cachedPromptCapabilities: AcpPromptCapabilities
  /** 本次连接周期内希望恢复的旧 session（来自 UI thread.agentSessionId） */
  pendingResumeSessionId: string | null
  /** session/load 回放历史时压制转发，避免与本地气泡重复 */
  suppressSessionUpdates: boolean
  /** 防止连点「连接」时旧 disconnect 拆掉新连接 */
  connectGeneration: number
  cachedAgentName: string | undefined
  cachedAgentVersion: string | undefined
  cachedProtocolVersion: number
  status: AcpConnectionStatus
  permissionBridge: AcpPermissionBridge | null
  snapshotBridge: AcpSnapshotBridge | null
  snapshotRequestSeq: number
  /** 权限请求自增序号（供 UI 回显，无待决 Map，直返 bridge 结果） */
  permissionSeq: number
  inkdownMcp: InkdownMcpServerHandle | null
  /** 目录副会话专用端点句柄（懒启动，随 disconnect 关闭） */
  tocMcp: InkdownMcpServerHandle | null
  /** 已绑过退出监听的温进程（复用时刷新代际，避免监听器堆积） */
  exitWatch: { handle: SpawnedAcpProcess; listener: () => void } | null
  sessionUpdateListeners: Set<AcpSessionUpdateListener>
  statusListeners: Set<AcpStatusListener>
  activePromptSessionId: string | null
} = {
  sdkApp: null,
  sdkConn: null,
  sdkStream: null,
  terminalManager: new AcpTerminalManager(),
  processHandle: null,
  sessionId: null,
  runtimeId: null,
  workspaceRoot: null,
  loadSessionSupported: false,
  resumeSessionSupported: false,
  cachedPromptCapabilities: {},
  pendingResumeSessionId: null,
  suppressSessionUpdates: false,
  connectGeneration: 0,
  cachedAgentName: undefined,
  cachedAgentVersion: undefined,
  cachedProtocolVersion: PROTOCOL_VERSION,
  status: 'disconnected',
  permissionBridge: null,
  snapshotBridge: null,
  snapshotRequestSeq: 0,
  permissionSeq: 0,
  inkdownMcp: null,
  tocMcp: null,
  exitWatch: null,
  sessionUpdateListeners: new Set<AcpSessionUpdateListener>(),
  statusListeners: new Set<AcpStatusListener>(),
  activePromptSessionId: null,
}

export function setStatus(next: AcpConnectionStatus, errorMessage?: string): void {
  acpState.status = next
  const event: AcpStatusChangedEvent = {
    status: next,
    runtimeId: acpState.runtimeId ?? undefined,
    sessionId: acpState.sessionId,
    errorMessage,
  }
  for (const listener of acpState.statusListeners) {
    try {
      listener(event)
    } catch (error) {
      console.error('[acp] status listener error', error)
    }
  }
}

export function onAcpSessionUpdate(listener: AcpSessionUpdateListener): () => void {
  acpState.sessionUpdateListeners.add(listener)
  return () => {
    acpState.sessionUpdateListeners.delete(listener)
  }
}

export function onAcpStatusChanged(listener: AcpStatusListener): () => void {
  acpState.statusListeners.add(listener)
  return () => {
    acpState.statusListeners.delete(listener)
  }
}

export function getAcpStatus(): AcpConnectionStatus {
  return acpState.status
}

export function getAcpSessionId(): string | null {
  return acpState.sessionId
}
