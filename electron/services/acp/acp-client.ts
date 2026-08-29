import { app } from 'electron'
import type { AppError } from '@shared/core/errors'
import { err, ok, type Result } from '@shared/core/result'
import type {
  AcpConnectResult,
  AcpConnectionStatus,
  AcpPermissionOutcome,
  AcpPromptResult,
  AcpSessionUpdateEvent,
  AcpStatusChangedEvent,
} from '@shared/types/acp'
import { getAcpRuntime } from './agent-registry'
import {
  createAcpClientMethodRouter,
  pickAllowOptionId,
  type PermissionDecision,
} from './client-handlers'
import {
  isJsonRpcNotification,
  isJsonRpcRequest,
  JsonRpcTransport,
} from './jsonrpc-transport'
import { disposeAllAcpProcesses, spawnAcpProcess, type SpawnedAcpProcess } from './process-manager'

const PROTOCOL_VERSION = 1

export type AcpSessionUpdateListener = (event: AcpSessionUpdateEvent) => void
export type AcpStatusListener = (event: AcpStatusChangedEvent) => void
export type AcpPermissionBridge = (payload: {
  requestId: number
  sessionId?: string
  params: Record<string, unknown>
}) => Promise<AcpPermissionOutcome>

let transport: JsonRpcTransport | null = null
let processHandle: SpawnedAcpProcess | null = null
let sessionId: string | null = null
let runtimeId: string | null = null
let status: AcpConnectionStatus = 'disconnected'
let permissionBridge: AcpPermissionBridge | null = null

const pendingPermissions = new Map<number, { resolve: (value: PermissionDecision) => void }>()
const sessionUpdateListeners = new Set<AcpSessionUpdateListener>()
const statusListeners = new Set<AcpStatusListener>()

function setStatus(next: AcpConnectionStatus, errorMessage?: string): void {
  status = next
  const event: AcpStatusChangedEvent = {
    status: next,
    runtimeId: runtimeId ?? undefined,
    sessionId,
    errorMessage,
  }
  for (const listener of statusListeners) {
    try {
      listener(event)
    } catch (error) {
      console.error('[acp] status listener error', error)
    }
  }
}

function toProtocolError(error: unknown, fallback: string): AppError {
  if (error instanceof Error) {
    const message = error.message
    const code =
      message.includes('超时') || message.toLowerCase().includes('timeout')
        ? 'ACP_TIMEOUT'
        : message.includes('spawn') || message.includes('ENOENT')
          ? 'ACP_SPAWN_ERROR'
          : 'ACP_PROTOCOL_ERROR'
    return { code, message: message || fallback }
  }
  return { code: 'ACP_PROTOCOL_ERROR', message: fallback }
}

function requireTransport(): Result<JsonRpcTransport, AppError> {
  if (!transport || status !== 'connected') {
    return err({ code: 'ACP_NOT_CONNECTED', message: 'ACP Agent 未连接' })
  }
  return ok(transport)
}

async function resolvePermission(params: Record<string, unknown>): Promise<PermissionDecision> {
  const allowId = pickAllowOptionId(params)
  if (allowId) return { outcome: 'selected', optionId: allowId }
  return { outcome: 'cancelled' }
}

async function handlePermissionRequest(
  requestId: number | string,
  params: Record<string, unknown>,
): Promise<PermissionDecision> {
  const numericId = typeof requestId === 'number' ? requestId : Number(requestId)
  if (!permissionBridge || !Number.isFinite(numericId)) {
    return resolvePermission(params)
  }

  return await new Promise<PermissionDecision>((resolve) => {
    pendingPermissions.set(numericId, { resolve })
    void permissionBridge!({
      requestId: numericId,
      sessionId: sessionId ?? undefined,
      params,
    })
      .then((outcome) => {
        if (!pendingPermissions.has(numericId)) return
        pendingPermissions.delete(numericId)
        resolve(outcome)
      })
      .catch(() => {
        if (!pendingPermissions.has(numericId)) return
        pendingPermissions.delete(numericId)
        resolve({ outcome: 'cancelled' })
      })
  })
}

function emitSessionUpdate(params: Record<string, unknown>): void {
  const sid = typeof params.sessionId === 'string' ? params.sessionId : (sessionId ?? '')
  const update =
    params.update && typeof params.update === 'object'
      ? (params.update as Record<string, unknown>)
      : params
  const event: AcpSessionUpdateEvent = { sessionId: sid, update }
  for (const listener of sessionUpdateListeners) {
    try {
      listener(event)
    } catch (error) {
      console.error('[acp] session update listener error', error)
    }
  }
}

export function setAcpPermissionBridge(bridge: AcpPermissionBridge | null): void {
  permissionBridge = bridge
}

export function onAcpSessionUpdate(listener: AcpSessionUpdateListener): () => void {
  sessionUpdateListeners.add(listener)
  return () => {
    sessionUpdateListeners.delete(listener)
  }
}

export function onAcpStatusChanged(listener: AcpStatusListener): () => void {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

export function getAcpStatus(): AcpConnectionStatus {
  return status
}

export function getAcpSessionId(): string | null {
  return sessionId
}

export async function connectAcp(payload: {
  runtimeId: string
  cwd?: string
}): Promise<Result<AcpConnectResult, AppError>> {
  const runtime = getAcpRuntime(payload.runtimeId)
  if (!runtime) {
    return err({ code: 'ACP_SPAWN_ERROR', message: `未知运行时: ${payload.runtimeId}` })
  }

  await disconnectAcp()

  runtimeId = runtime.id
  setStatus('connecting')

  const cwd = payload.cwd?.trim() || process.cwd()

  try {
    processHandle = spawnAcpProcess({
      runtime,
      cwd,
      onExit: () => {
        if (status === 'connected' || status === 'connecting') {
          void disconnectAcp('Agent 进程已退出')
        }
      },
    })

    const child = processHandle.child
    if (!child.stdout || !child.stdin) {
      processHandle.kill()
      processHandle = null
      setStatus('error', '子进程 stdio 不可用')
      return err({ code: 'ACP_SPAWN_ERROR', message: '子进程 stdio 不可用' })
    }

    const localTransport = new JsonRpcTransport(child.stdout, child.stdin, {
      requestTimeoutMs: 120_000,
      onMessage: async (message) => {
        if (isJsonRpcRequest(message)) {
          const router = createAcpClientMethodRouter(localTransport, ({ requestId, params }) =>
            handlePermissionRequest(requestId, params),
          )
          await router(message)
          return
        }

        if (isJsonRpcNotification(message) && message.method === 'session/update') {
          const params =
            message.params && typeof message.params === 'object'
              ? (message.params as Record<string, unknown>)
              : {}
          emitSessionUpdate(params)
        }
      },
      onError: (error) => {
        console.error('[acp] transport error', error)
      },
    })

    transport = localTransport

    const initResult = (await localTransport.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {},
      clientInfo: {
        name: 'inkdown',
        title: '轻量阅读器',
        version: app.getVersion(),
      },
    })) as Record<string, unknown>

    const negotiated =
      typeof initResult.protocolVersion === 'number' ? initResult.protocolVersion : PROTOCOL_VERSION
    if (negotiated !== PROTOCOL_VERSION) {
      await disconnectAcp(`协议版本不兼容: Agent=${negotiated}`)
      return err({
        code: 'ACP_PROTOCOL_ERROR',
        message: `协议版本不兼容（需要 ${PROTOCOL_VERSION}，得到 ${negotiated}）`,
      })
    }

    const agentInfo =
      initResult.agentInfo && typeof initResult.agentInfo === 'object'
        ? (initResult.agentInfo as Record<string, unknown>)
        : undefined

    const authMethods = initResult.authMethods
    if (Array.isArray(authMethods) && authMethods.length > 0) {
      const first = authMethods[0] as Record<string, unknown> | undefined
      const methodId = typeof first?.id === 'string' ? first.id : undefined
      if (methodId) {
        try {
          await localTransport.request('authenticate', { methodId })
        } catch (error) {
          console.warn('[acp] authenticate 失败，继续尝试 session/new', error)
        }
      }
    }

    const sessionResult = (await localTransport.request('session/new', {
      cwd,
      mcpServers: [],
    })) as Record<string, unknown>

    const newSessionId =
      typeof sessionResult.sessionId === 'string' ? sessionResult.sessionId : null
    if (!newSessionId) {
      await disconnectAcp('session/new 未返回 sessionId')
      return err({ code: 'ACP_PROTOCOL_ERROR', message: 'session/new 未返回 sessionId' })
    }

    sessionId = newSessionId
    setStatus('connected')

    return ok({
      runtimeId: runtime.id,
      sessionId: newSessionId,
      protocolVersion: negotiated,
      agentName: typeof agentInfo?.name === 'string' ? agentInfo.name : undefined,
      agentVersion: typeof agentInfo?.version === 'string' ? agentInfo.version : undefined,
    })
  } catch (error) {
    await disconnectAcp()
    setStatus('error', error instanceof Error ? error.message : String(error))
    return err(toProtocolError(error, '连接 ACP Agent 失败'))
  }
}

export async function disconnectAcp(reason?: string): Promise<Result<void, AppError>> {
  for (const [, pending] of pendingPermissions) {
    pending.resolve({ outcome: 'cancelled' })
  }
  pendingPermissions.clear()

  transport?.dispose()
  transport = null

  processHandle?.kill()
  processHandle = null

  sessionId = null
  runtimeId = null
  setStatus('disconnected', reason)
  return ok(undefined)
}

export async function createAcpSession(
  cwd: string,
): Promise<Result<{ sessionId: string }, AppError>> {
  const t = requireTransport()
  if (!t.ok) return t

  try {
    const result = (await t.value.request('session/new', {
      cwd,
      mcpServers: [],
    })) as Record<string, unknown>
    const id = typeof result.sessionId === 'string' ? result.sessionId : null
    if (!id) {
      return err({ code: 'ACP_PROTOCOL_ERROR', message: 'session/new 未返回 sessionId' })
    }
    sessionId = id
    setStatus('connected')
    return ok({ sessionId: id })
  } catch (error) {
    return err(toProtocolError(error, '创建会话失败'))
  }
}

export async function promptAcp(payload: {
  sessionId: string
  text: string
}): Promise<Result<AcpPromptResult, AppError>> {
  const t = requireTransport()
  if (!t.ok) return t

  try {
    const result = (await t.value.request('session/prompt', {
      sessionId: payload.sessionId,
      prompt: [{ type: 'text', text: payload.text }],
    })) as Record<string, unknown>
    const stopReason = typeof result.stopReason === 'string' ? result.stopReason : 'end_turn'
    return ok({ stopReason })
  } catch (error) {
    return err(toProtocolError(error, '发送 prompt 失败'))
  }
}

export function cancelAcp(payload: { sessionId: string }): Result<void, AppError> {
  const t = requireTransport()
  if (!t.ok) return t
  try {
    t.value.notify('session/cancel', { sessionId: payload.sessionId })
    for (const [id, pending] of pendingPermissions) {
      pending.resolve({ outcome: 'cancelled' })
      pendingPermissions.delete(id)
    }
    return ok(undefined)
  } catch (error) {
    return err(toProtocolError(error, '取消失败'))
  }
}

export function respondAcpPermission(
  requestId: number,
  outcome: AcpPermissionOutcome,
): Result<void, AppError> {
  const pending = pendingPermissions.get(requestId)
  if (!pending) {
    return err({ code: 'ACP_PROTOCOL_ERROR', message: `无待处理权限请求: ${requestId}` })
  }
  pendingPermissions.delete(requestId)
  pending.resolve(outcome)
  return ok(undefined)
}

export function disposeAllAcp(): void {
  void disconnectAcp()
  disposeAllAcpProcesses()
}

/** 测试钩子：注入已构造的 transport（跳过 spawn） */
export function __setAcpTransportForTests(next: JsonRpcTransport | null, nextSessionId?: string): void {
  transport = next
  sessionId = nextSessionId ?? null
  status = next ? 'connected' : 'disconnected'
}
