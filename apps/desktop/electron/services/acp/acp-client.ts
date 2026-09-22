import { app } from 'electron'
import {
  APP_TITLE,
  findBuiltinAcpRuntime,
} from '@inkdown/contracts'
import type { AppError } from '@inkdown/contracts'
import { err, ok, type Result } from '@inkdown/contracts'
import type {
  AcpAuthMethod,
  AcpAuthPreflightResult,
  AcpConnectResult,
  AcpConnectionStatus,
  AcpContentBlock,
  AcpPermissionOutcome,
  AcpPromptCapabilities,
  AcpPromptResult,
  AcpSessionUpdateEvent,
  AcpSetConfigOptionResult,
  AcpStatusChangedEvent,
} from '@inkdown/contracts'
import type {
  AcpRuntimeInfo,
  InkdownSnapshotArgs,
  InkdownSnapshotResource,
} from '@inkdown/contracts'
import {
  methods,
  type ClientApp,
  type ClientConnection,
  type ClientContext,
  type InitializeResponse,
} from '@agentclientprotocol/sdk'
import { getAcpRuntime } from '@inkdown/acp'
import { resolveAgentCwd } from './agent-sandbox-cwd'
import { parseAcpConfigOptions } from '@inkdown/acp'
import { registerAcpClientHandlers } from './client-handlers'
import { buildAcpProxySpawnEnv, readAcpProxySettings } from './acp-proxy-service'
import { getAcpRuntimeAdapter } from './runtimes'
import { runConnectAuthGate } from '@inkdown/acp'
import { AcpTerminalManager } from './acp-terminal'
import {
  parseLoadSessionSupported,
  parseMcpHttpSupported,
  parsePromptCapabilities,
  parseResumeSessionSupported,
} from '@inkdown/acp'
import {
  startInkdownMcpServer,
  startTocMcpServer,
  stopInkdownMcpServer,
  type InkdownMcpServerHandle,
} from './mcp/inkdown-mcp-server'
import { restoreOrCreateAcpSession } from './session-open'
import { connectSdkClient, sdkRequest, type SdkStreamHandle } from './sdk-client'
import { disposeAllAcpProcesses, getLiveAcpProcess, isSpawnedAcpProcessAlive, spawnAcpProcess, type SpawnedAcpProcess } from './process-manager'
import { ensureBunForCommand, mapSpawnErrorToAppError } from '../bun-runtime'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const PROTOCOL_VERSION = 1

/** 非 codex-acp 运行时的中性 preflight：无本地登录痕迹 → gate 走协议 authMethods 弹向导 */
const NEUTRAL_AUTH_PREFLIGHT: AcpAuthPreflightResult = {
  codexHome: '',
  hasCodexHome: false,
  hasAuthFile: false,
  hasApiKeyEnv: false,
  looksLoggedIn: false,
}

/**
 * 多运行时模板解析（防御性）：
 * 约定接口 `findBuiltinAcpRuntime(id) -> { command, args }` 为唯一真相源。
 * 优先走 `@inkdown/acp` 注册表（其内部同样委托该函数），若其滞后则直读 contracts 回落。
 * 下游 contracts 展开 7 模板前，未知 id 在此直接判错，不触达 spawn。
 */
// TODO(下游 contracts 未就绪): 7 运行时模板
// （codex+claude+gemini+copilot+opencode+cursor-cli+deepseek）落地后，本函数零改动直接生效。
function resolveRuntimeTemplate(runtimeId: string): AcpRuntimeInfo | undefined {
  const normalized = runtimeId?.trim() ?? ''
  if (!normalized) return undefined
  try {
    const viaRegistry = getAcpRuntime(normalized)
    if (viaRegistry?.command) return viaRegistry
  } catch {
    // 注册表滞后时忽略，走 contracts 直读
  }
  try {
    const direct = findBuiltinAcpRuntime(normalized)
    if (direct?.command) return direct
  } catch {
    // contracts 未就绪时返回 undefined，由调用方判错
  }
  return undefined
}

/** 防御性取 adapter：`getAcpRuntimeAdapter(id)` 为准，异常时回落中性空 adapter。 */
function safeGetAdapter(runtimeId: string) {
  try {
    return getAcpRuntimeAdapter(runtimeId)
  } catch (error) {
    console.warn('[acp] getAcpRuntimeAdapter 异常，回落中性 adapter', runtimeId, error)
    return getAcpRuntimeAdapter('__unknown__')
  }
}

function safeProbeAuth(adapter: ReturnType<typeof getAcpRuntimeAdapter>): AcpAuthPreflightResult {
  try {
    const probed = adapter.probeAuth()
    if (probed && typeof probed === 'object') return probed
  } catch (error) {
    console.warn('[acp] probeAuth 异常，回落中性 preflight', error)
  }
  return { ...NEUTRAL_AUTH_PREFLIGHT }
}

function safeOrderAuthMethods(
  adapter: ReturnType<typeof getAcpRuntimeAdapter>,
  methodsList: AcpAuthMethod[],
): AcpAuthMethod[] {
  if (!adapter.orderAuthMethods) return methodsList
  try {
    return adapter.orderAuthMethods(methodsList)
  } catch (error) {
    console.warn('[acp] orderAuthMethods 异常，保持原始顺序', error)
    return methodsList
  }
}

function safeCanSkipInteractiveAuth(
  adapter: ReturnType<typeof getAcpRuntimeAdapter>,
  methodId: string,
  force?: boolean,
): boolean {
  if (!adapter.canSkipInteractiveAuth) return false
  try {
    return adapter.canSkipInteractiveAuth(methodId, force) === true
  } catch (error) {
    console.warn('[acp] canSkipInteractiveAuth 异常，走交互式认证', error)
    return false
  }
}


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

let sdkApp: ClientApp | null = null
let sdkConn: ClientConnection | null = null
let sdkStream: SdkStreamHandle | null = null
let terminalManager = new AcpTerminalManager()
let processHandle: SpawnedAcpProcess | null = null
let sessionId: string | null = null
let runtimeId: string | null = null
let workspaceRoot: string | null = null
let loadSessionSupported = false
let resumeSessionSupported = false
let cachedPromptCapabilities: AcpPromptCapabilities = {}
/** 本次连接周期内希望恢复的旧 session（来自 UI thread.agentSessionId） */
let pendingResumeSessionId: string | null = null
/** session/load 回放历史时压制转发，避免与本地气泡重复 */
let suppressSessionUpdates = false
/** 防止连点「连接」时旧 disconnect 拆掉新连接 */
let connectGeneration = 0
let cachedAgentName: string | undefined
let cachedAgentVersion: string | undefined
let cachedProtocolVersion = PROTOCOL_VERSION
let status: AcpConnectionStatus = 'disconnected'
let permissionBridge: AcpPermissionBridge | null = null
let snapshotBridge: AcpSnapshotBridge | null = null
let snapshotRequestSeq = 0
/** 权限请求自增序号（供 UI 回显，无待决 Map，直返 bridge 结果） */
let permissionSeq = 0
let inkdownMcp: InkdownMcpServerHandle | null = null
/** 目录副会话专用端点句柄（懒启动，随 disconnect 关闭） */
let tocMcp: InkdownMcpServerHandle | null = null
/** 已绑过退出监听的温进程（复用时刷新代际，避免监听器堆积） */
let exitWatch: { handle: SpawnedAcpProcess; listener: () => void } | null = null

/**
 * 给温进程绑定单次退出监听。每次复用都刷新闭包里的代际，
 * 旧监听先摘掉，保证同时只有一个有效监听。
 */
function watchProcessExit(handle: SpawnedAcpProcess, gen: number): void {
  if (exitWatch) {
    exitWatch.handle.child.off('exit', exitWatch.listener)
    exitWatch = null
  }
  const listener = () => {
    if (gen !== connectGeneration) return
    if (
      status === 'connected' ||
      status === 'connecting' ||
      status === 'awaiting_auth'
    ) {
      void disconnectAcp('Agent 进程已退出')
    }
  }
  handle.child.once('exit', listener)
  exitWatch = { handle, listener }
}

function mcpServerEntry(handle: InkdownMcpServerHandle, name: string): unknown[] {
  return [
    {
      type: 'http',
      name,
      url: handle.url,
      headers: [{ name: 'Authorization', value: `Bearer ${handle.authToken}` }],
    },
  ]
}

async function ensureTocMcpServer(): Promise<InkdownMcpServerHandle> {
  if (!tocMcp) {
    tocMcp = await startTocMcpServer({ readSnapshot: handleSnapshotRequest })
  }
  return tocMcp
}

const sessionUpdateListeners = new Set<AcpSessionUpdateListener>()
const statusListeners = new Set<AcpStatusListener>()
let activePromptSessionId: string | null = null

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
  return mapSpawnErrorToAppError(error, fallback)
}

function requireAgent(allowAuthPhase = false): Result<ClientContext, AppError> {
  if (!sdkConn) {
    return err({ code: 'ACP_NOT_CONNECTED', message: 'ACP Agent 未连接' })
  }
  if (status === 'connected') return ok(sdkConn.agent)
  if (allowAuthPhase && (status === 'connecting' || status === 'awaiting_auth')) {
    return ok(sdkConn.agent)
  }
  return err({ code: 'ACP_NOT_CONNECTED', message: 'ACP Agent 未连接' })
}

function parseAuthMethods(raw: unknown): AcpAuthMethod[] {
  if (!Array.isArray(raw)) return []
  const methods: AcpAuthMethod[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || !row.id) continue
    methods.push({
      id: row.id,
      name: typeof row.name === 'string' ? row.name : row.id,
      description: typeof row.description === 'string' ? row.description : undefined,
      type: typeof row.type === 'string' ? row.type : undefined,
    })
  }
  return methods
}

async function openSessionAfterAuth(
  cwd: string,
  options?: { keepAliveOnFailure?: boolean },
): Promise<Result<Extract<AcpConnectResult, { phase: 'ready' }>, AppError>> {
  const a = requireAgent(true)
  if (!a.ok) return err(a.error)
  if (!runtimeId) {
    return err({ code: 'ACP_NOT_CONNECTED', message: '运行时未知' })
  }

  const resumeId = pendingResumeSessionId?.trim() || null

  try {
    const opened = await restoreOrCreateAcpSession({
      request: (method, params) => sdkRequest<unknown, unknown>(a.value, method, params),
      cwd,
      resumeSessionId: resumeId,
      resumeSupported: resumeSessionSupported,
      loadSupported: loadSessionSupported,
      mcpServers: inkdownMcp
        ? [
            {
              type: 'http',
              name: 'inkdown',
              url: inkdownMcp.url,
              headers: [{ name: 'Authorization', value: `Bearer ${inkdownMcp.authToken}` }],
            },
          ]
        : [],
      onSuppressUpdates: (suppress) => {
        suppressSessionUpdates = suppress
      },
    })

    sessionId = opened.sessionId
    workspaceRoot = cwd
    pendingResumeSessionId = null
    setStatus('connected')

    return ok({
      phase: 'ready',
      runtimeId,
      sessionId: opened.sessionId,
      protocolVersion: cachedProtocolVersion,
      agentName: cachedAgentName,
      agentVersion: cachedAgentVersion,
      configOptions: parseAcpConfigOptions(opened.configOptions),
      loadSessionSupported,
      resumeSessionSupported,
      promptCapabilities: cachedPromptCapabilities,
      sessionRestored: opened.sessionRestored,
      restoreMethod: opened.restoreMethod,
      requestedSessionId: opened.requestedSessionId,
      restoreAttempts:
        opened.restoreAttempts.length > 0 ? opened.restoreAttempts : undefined,
    })
  } catch (error) {
    if (!options?.keepAliveOnFailure) {
      await disconnectAcp()
    }
    return err(toProtocolError(error, '创建或恢复会话失败'))
  }
}

async function handlePermissionRequest(
  permSessionId: string | undefined,
  params: Record<string, unknown>,
): Promise<AcpPermissionOutcome> {
  console.info('[acp] handlePermissionRequest', {
    hasBridge: Boolean(permissionBridge),
    optionCount: Array.isArray(params.options) ? params.options.length : 0,
  })
  if (!permissionBridge) {
    // 无 bridge 时直接 cancelled，禁静默 allow
    console.warn('[acp] permissionBridge 不可用，直接 cancelled（禁静默 allow）')
    return { outcome: 'cancelled' }
  }

  permissionSeq += 1
  const requestId = permissionSeq
  const sid = permSessionId?.trim() ? permSessionId : (sessionId ?? undefined)
  try {
    const outcome = await permissionBridge({ requestId, sessionId: sid, params })
    console.info('[acp] permissionBridge 返回', { requestId, outcome })
    return outcome
  } catch (error) {
    console.error('[acp] permissionBridge 异常，cancelled', error)
    return { outcome: 'cancelled' }
  }
}

function emitSessionUpdate(params: Record<string, unknown>): void {
  if (suppressSessionUpdates) return
  const sid =
    typeof params.sessionId === 'string' && params.sessionId.trim()
      ? params.sessionId.trim()
      : (activePromptSessionId ?? sessionId ?? '')
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

export function setAcpSnapshotBridge(bridge: AcpSnapshotBridge | null): void {
  snapshotBridge = bridge
}

async function handleSnapshotRequest(
  resource: InkdownSnapshotResource,
  args?: InkdownSnapshotArgs,
): Promise<string> {
  if (!snapshotBridge) {
    throw new Error('Inkdown 快照桥未就绪，请稍后重试')
  }
  snapshotRequestSeq += 1
  return await snapshotBridge({ requestId: snapshotRequestSeq, resource, args })
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

export {
  ensureAgentSandboxCwd,
  resolveAgentCwd,
  type AgentCwdSource,
  type ResolvedAgentCwd,
} from './agent-sandbox-cwd'

export async function connectAcp(payload: {
  runtimeId: string
  cwd?: string
  resumeSessionId?: string
}): Promise<Result<AcpConnectResult, AppError>> {
  // spawn 模板一律取自 findBuiltinAcpRuntime（经 resolveRuntimeTemplate），
  // 禁写死 codex bunx；command/args 缺失即判错，不触达 spawn。
  const runtime = resolveRuntimeTemplate(payload.runtimeId)
  if (!runtime || !runtime.command || !Array.isArray(runtime.args)) {
    return err({ code: 'ACP_SPAWN_ERROR', message: `未知运行时: ${payload.runtimeId}` })
  }

  const gen = ++connectGeneration
  console.info('[acp] connect start', {
    gen,
    runtimeId: payload.runtimeId,
    resumeSessionId: payload.resumeSessionId,
  })

  // 常驻复用：同 runtime 有存活温进程时跳过冷启动（省掉解压 + 导包）。
  // 温进程是否健康由后面的
  // initialize 握手验证；若握手失败，catch 会杀掉毒进程，下次点击走冷启动自愈。
  const warmHandle = getLiveAcpProcess(runtime.id)
  if (warmHandle) {
    // 剥离旧会话状态但保温进程：旧 SDK 连接只关闭，不断 stdio。
    await disconnectAcp()
    processHandle = warmHandle
  } else {
    await disconnectAcp(undefined, { killProcess: true })
    // 给旧进程/stdio 一点时间收尾，降低连接竞态
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
  if (gen !== connectGeneration) {
    return err({ code: 'ACP_PROTOCOL_ERROR', message: '连接已被更新的请求取代' })
  }

  runtimeId = runtime.id
  pendingResumeSessionId = payload.resumeSessionId?.trim() || null
  setStatus('connecting')

  const adapter = safeGetAdapter(runtime.id)

  // 启动前钩子：各 runtime 自理副作用（如凭据桥接同步 refresh_token）。
  // 防御性：下游 adapter 未就绪/抛错时不阻断连接。
  if (adapter.beforeSpawn) {
    try {
      await adapter.beforeSpawn()
    } catch (error) {
      console.warn('[acp] beforeSpawn 异常，继续连接', error)
    }
  }

  const bunCheck = await ensureBunForCommand(runtime.command)
  if (!bunCheck.ok) {
    setStatus('error', bunCheck.error.message)
    return bunCheck
  }
  if (gen !== connectGeneration) {
    return err({ code: 'ACP_PROTOCOL_ERROR', message: '连接已被更新的请求取代' })
  }

  const { cwd } = resolveAgentCwd(payload.cwd)
  workspaceRoot = cwd

  // 代理环境变量：优先委托 adapter.getSpawnEnv，未声明/抛错则走通用 acp-proxy
  const proxySettings = await readAcpProxySettings()
  let proxyResult: { env: NodeJS.ProcessEnv; envRemove: string[] }
  try {
    proxyResult = adapter.getSpawnEnv
      ? adapter.getSpawnEnv(proxySettings)
      : buildAcpProxySpawnEnv(proxySettings)
  } catch (error) {
    console.warn('[acp] getSpawnEnv 异常，回落通用代理 env', error)
    proxyResult = buildAcpProxySpawnEnv(proxySettings)
  }

  // 自定义供应商模式（Codex 等）：隔离 CODEX_HOME + 注入 Key；非 codex 走空 env
  let customProviderEnv: NodeJS.ProcessEnv = {}
  if (adapter.getCustomProvider) {
    try {
      const custom = await adapter.getCustomProvider()
      customProviderEnv = custom?.customEnv ?? {}
    } catch (error) {
      console.warn('[acp] getCustomProvider 异常，忽略自定义供应商', error)
    }
  }

  try {
    // 冷启动才做 runtime 级副作用；温进程复用路径跳过，追求毫秒级重连。
    if (!warmHandle && adapter.onColdStart) {
      try {
        await adapter.onColdStart()
      } catch (error) {
        console.warn('[acp] onColdStart 异常，继续冷启动', error)
      }
    }
    if (warmHandle) {
      // 温进程复用：跳过 spawn，直接用原子进程 stdio 建新 SDK 连接并走握手
      processHandle = warmHandle
      watchProcessExit(warmHandle, gen)
    } else {
    processHandle = spawnAcpProcess({
      runtime,
      cwd,
      env: {
        ...customProviderEnv,
        ...proxyResult.env,
      },
      envRemove: proxyResult.envRemove,
      onExit: () => {
        if (gen !== connectGeneration) return
        if (
          status === 'connected' ||
          status === 'connecting' ||
          status === 'awaiting_auth'
        ) {
          void disconnectAcp('Agent 进程已退出')
        }
      },
    })
    }

    if (gen !== connectGeneration) {
      processHandle.kill()
      processHandle = null
      return err({ code: 'ACP_PROTOCOL_ERROR', message: '连接已被更新的请求取代' })
    }

    const child = processHandle.child
    if (!child.stdout || !child.stdin) {
      processHandle.kill()
      processHandle = null
      setStatus('error', '子进程 stdio 不可用')
      return err({ code: 'ACP_SPAWN_ERROR', message: '子进程 stdio 不可用' })
    }

    // SDK 长驻连接：client({ name: 'inkdown' }).connect()，持有 ClientConnection。
    // 回调经 onRequest/onNotification 注册；stdio 经 toWeb→ndJsonStream 桥接。
    // SDK 调用沿用直迁形态，仅增参 runtimeId 供日志/隔离（sdk-client 签名向后兼容）。
    const created = connectSdkClient(
      child,
      (sdk) => {
        registerAcpClientHandlers(sdk, {
          getWorkspaceRoot: () => workspaceRoot,
          terminals: terminalManager,
          readSnapshot: handleSnapshotRequest,
          onPermission: ({ sessionId: permSessionId, params }) =>
            handlePermissionRequest(permSessionId, params),
          onSessionUpdate: (params) => emitSessionUpdate(params),
        })
      },
      runtime.id,
    )
    sdkApp = created.app
    sdkConn = created.connection
    sdkStream = created.streamHandle

    const initResult = await sdkRequest<InitializeResponse, Record<string, unknown>>(
      sdkConn.agent,
      methods.agent.initialize,
      {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
          terminal: true,
        },
        clientInfo: {
          name: 'inkdown',
          title: APP_TITLE,
          version: app.getVersion(),
        },
      },
    )

    const negotiated =
      typeof initResult.protocolVersion === 'number' ? initResult.protocolVersion : PROTOCOL_VERSION
    if (negotiated !== PROTOCOL_VERSION) {
      // 协议对不上：该进程服务不了我们，杀掉避免温复用毒进程
      await disconnectAcp(`协议版本不兼容: Agent=${negotiated}`, { killProcess: true })
      return err({
        code: 'ACP_PROTOCOL_ERROR',
        message: `协议版本不兼容（需要 ${PROTOCOL_VERSION}，得到 ${negotiated}）`,
      })
    }

    cachedProtocolVersion = negotiated

    const agentInfo = initResult.agentInfo ?? undefined
    cachedAgentName = typeof agentInfo?.name === 'string' ? agentInfo.name : undefined
    cachedAgentVersion = typeof agentInfo?.version === 'string' ? agentInfo.version : undefined

    const caps = (initResult.agentCapabilities ?? {}) as unknown as Record<string, unknown>
    loadSessionSupported = parseLoadSessionSupported(caps)
    resumeSessionSupported = parseResumeSessionSupported(caps)
    cachedPromptCapabilities = parsePromptCapabilities(caps)

    // codex 不会主动走 fs/read_text_file，只有 MCP 工具能让它拉到我们的内存数据
    if (parseMcpHttpSupported(caps)) {
      inkdownMcp = await startInkdownMcpServer({ readSnapshot: handleSnapshotRequest })
    } else {
      inkdownMcp = null
      console.warn('[acp-mcp] Agent 未声明 mcpCapabilities.http，Inkdown 工具不可用')
    }

    // preflight/auth gate 一律走 adapter.probeAuth（防御性回落中性结果）；
    // authMethods 排序走 adapter.orderAuthMethods（可选）。
    let authMethods = parseAuthMethods(initResult.authMethods)
    authMethods = safeOrderAuthMethods(adapter, authMethods)

    const preflight = safeProbeAuth(adapter)
    let openedWithoutAuth: Extract<AcpConnectResult, { phase: 'ready' }> | null = null
    const gate = await runConnectAuthGate(authMethods, preflight, {
      // 本地已有凭据（如 ~/.codex）时，一律优先直接建立会话（session/new）
      preferDirectSession: true,
      authenticate: async (methodId) => {
        await sdkRequest<unknown, Record<string, unknown>>(sdkConn!.agent, methods.agent.authenticate, {
          methodId,
        })
      },
      tryOpenSessionWithoutAuth: async () => {
        const direct = await openSessionAfterAuth(cwd, { keepAliveOnFailure: true })
        if (direct.ok) {
          openedWithoutAuth = direct.value
          return true
        }
        return false
      },
    })

    if (gate.outcome === 'needs_auth') {
      setStatus('awaiting_auth')
      return ok({
        phase: 'needs_auth',
        runtimeId: runtime.id,
        protocolVersion: negotiated,
        agentName: cachedAgentName,
        agentVersion: cachedAgentVersion,
        authMethods: gate.methods,
        loadSessionSupported,
        resumeSessionSupported,
        promptCapabilities: cachedPromptCapabilities,
      })
    }

    if (gate.outcome === 'session_without_auth' && openedWithoutAuth) {
      return ok(openedWithoutAuth)
    }

    return await openSessionAfterAuth(cwd)
  } catch (error) {
    if (gen !== connectGeneration) {
      return err({ code: 'ACP_PROTOCOL_ERROR', message: '连接已被更新的请求取代' })
    }
    // 未知异常：进程状态不可信，杀掉避免下次复用毒进程
    await disconnectAcp(undefined, { killProcess: true })
    setStatus('error', error instanceof Error ? error.message : String(error))
    return err(toProtocolError(error, '连接 ACP Agent 失败'))
  }
}

export async function authenticateAcp(payload: {
  methodId: string
  force?: boolean
}): Promise<Result<Extract<AcpConnectResult, { phase: 'ready' }>, AppError>> {
  const a = requireAgent(true)
  if (!a.ok) return err(a.error)
  const cwd = resolveAgentCwd(workspaceRoot).cwd

  const adapter = safeGetAdapter(runtimeId ?? '')
  // 认证守门员逻辑：官方 ACP 收到 authenticate 请求时无脑拉起系统浏览器；
  // 若本地已持有有效 Token，直接复用已有凭据建立会话，杜绝弹出系统浏览器
  if (safeCanSkipInteractiveAuth(adapter, payload.methodId, payload.force)) {
    console.info('[acp] 认证守门员生效：本地凭据已就绪，跳过交互式 authenticate，直接建立会话')
    return await openSessionAfterAuth(cwd)
  }

  try {
    await sdkRequest<unknown, Record<string, unknown>>(a.value, methods.agent.authenticate, {
      methodId: payload.methodId,
    })
    return await openSessionAfterAuth(cwd)
  } catch (error) {
    return err(toProtocolError(error, '认证失败'))
  }
}

export async function loadAcpSession(payload: {
  sessionId: string
  cwd?: string
  secondary?: boolean
}): Promise<
  Result<{ sessionId: string; configOptions: ReturnType<typeof parseAcpConfigOptions> }, AppError>
> {
  const a = requireAgent()
  if (!a.ok) return err(a.error)
  if (!loadSessionSupported) {
    return err({
      code: 'ACP_PROTOCOL_ERROR',
      message: '当前 Agent 未声明 loadSession 能力',
    })
  }

  const cwd = resolveAgentCwd(payload.cwd || workspaceRoot).cwd

  const secondary = payload.secondary === true
  if (secondary) suppressSessionUpdates = true

  try {
    const result = await sdkRequest<Record<string, unknown>, Record<string, unknown>>(
      a.value,
      methods.agent.session.load,
      {
        sessionId: payload.sessionId,
        cwd,
        mcpServers: inkdownMcp
          ? [
              {
                type: 'http',
                name: 'inkdown',
                url: inkdownMcp.url,
                headers: [{ name: 'Authorization', value: `Bearer ${inkdownMcp.authToken}` }],
              },
            ]
          : [],
      },
    )
    const id =
      typeof result.sessionId === 'string' ? result.sessionId : payload.sessionId
    if (!secondary) {
      sessionId = id
      workspaceRoot = cwd
      setStatus('connected')
    } else if (!workspaceRoot) {
      workspaceRoot = cwd
    }
    return ok({
      sessionId: id,
      configOptions: parseAcpConfigOptions(result.configOptions),
    })
  } catch (error) {
    return err(toProtocolError(error, '加载会话失败'))
  } finally {
    if (secondary) suppressSessionUpdates = false
  }
}

export async function disconnectAcp(
  reason?: string,
  opts?: { killProcess?: boolean },
): Promise<Result<void, AppError>> {
  terminalManager.releaseAll()

  // SDK 长驻连接关闭：在途请求一并取消（无待决 Map，直返 bridge 结果）
  try {
    sdkConn?.close()
  } catch {
    // 忽略竞态关闭
  }
  sdkConn = null
  sdkApp = null

  // 摘桥接：只吃掉垫层，保住温进程 stdio 给下次复用
  try {
    sdkStream?.dispose()
  } catch {
    // 忽略竞态关闭
  }
  sdkStream = null

  if (processHandle) {
    // 已死句柄一律回收；存活进程默认保温（killProcess=false），下次同 runtime
    // 连接直接复用，省掉冷启动。只有明确可疑或 App 退出时才整树杀掉。
    if (opts?.killProcess || !isSpawnedAcpProcessAlive(processHandle)) {
      if (exitWatch?.handle === processHandle) {
        processHandle.child.off('exit', exitWatch.listener)
        exitWatch = null
      }
      processHandle.kill()
      processHandle = null
    }
  }

  await stopInkdownMcpServer()
  inkdownMcp = null
  tocMcp = null

  sessionId = null
  runtimeId = null
  workspaceRoot = null
  loadSessionSupported = false
  resumeSessionSupported = false
  cachedPromptCapabilities = {}
  pendingResumeSessionId = null
  suppressSessionUpdates = false
  cachedAgentName = undefined
  cachedAgentVersion = undefined
  setStatus('disconnected', reason)
  return ok(undefined)
}

/**
 * 在已连接的 Agent 进程上再建一条 session（如批注助手）。
 * **不**覆盖主面板的 sessionId，避免副会话抢走主会话身份。
 * cwd 可省略：沿用 connect 时记下的 workspaceRoot。
 * toolScope='toc' 时只挂目录工具表（目录副会话专用，主会话看不到）。
 */
export async function createAcpSession(
  cwd?: string,
  toolScope: 'full' | 'toc' = 'full',
): Promise<Result<{ sessionId: string; configOptions: ReturnType<typeof parseAcpConfigOptions> }, AppError>> {
  const a = requireAgent()
  if (!a.ok) return err(a.error)

  const resolvedCwd = resolveAgentCwd(cwd || workspaceRoot).cwd

  try {
    const mcpServers =
      toolScope === 'toc'
        ? mcpServerEntry(await ensureTocMcpServer(), 'inkdown-toc')
        : inkdownMcp
          ? mcpServerEntry(inkdownMcp, 'inkdown')
          : []
    const result = await sdkRequest<Record<string, unknown>, Record<string, unknown>>(
      a.value,
      methods.agent.session.new,
      {
        cwd: resolvedCwd,
        mcpServers,
      },
    )
    const id = typeof result.sessionId === 'string' ? result.sessionId : null
    if (!id) {
      return err({ code: 'ACP_PROTOCOL_ERROR', message: 'session/new 未返回 sessionId' })
    }
    if (!workspaceRoot) workspaceRoot = resolvedCwd
    return ok({
      sessionId: id,
      configOptions: parseAcpConfigOptions(result.configOptions),
    })
  } catch (error) {
    return err(toProtocolError(error, '创建会话失败'))
  }
}

export async function setAcpConfigOption(payload: {
  sessionId: string
  configId: string
  value: string | boolean
}): Promise<Result<AcpSetConfigOptionResult, AppError>> {
  const a = requireAgent()
  if (!a.ok) return err(a.error)

  try {
    const result = await sdkRequest<Record<string, unknown>, Record<string, unknown>>(
      a.value,
      methods.agent.session.setConfigOption,
      {
        sessionId: payload.sessionId,
        configId: payload.configId,
        value: payload.value,
      },
    )
    const configOptions = parseAcpConfigOptions(
      result.configOptions ?? result,
    )
    // 部分 Agent 直接返回数组
    const parsed =
      configOptions.length > 0
        ? configOptions
        : parseAcpConfigOptions(Array.isArray(result) ? result : [])
    return ok({ configOptions: parsed })
  } catch (error) {
    return err(toProtocolError(error, '设置配置项失败'))
  }
}

export async function promptAcp(payload: {
  sessionId: string
  prompt: AcpContentBlock[]
}): Promise<Result<AcpPromptResult, AppError>> {
  const a = requireAgent()
  if (!a.ok) return err(a.error)

  const prompt = Array.isArray(payload.prompt) ? payload.prompt : []
  if (prompt.length === 0) {
    return err({ code: 'ACP_PROTOCOL_ERROR', message: 'prompt 不能为空' })
  }

  const prevActiveSessionId = activePromptSessionId
  activePromptSessionId = payload.sessionId
  try {
    const result = await sdkRequest<Record<string, unknown>, Record<string, unknown>>(
      a.value,
      methods.agent.session.prompt,
      {
        sessionId: payload.sessionId,
        prompt,
      },
    )
    const stopReason = typeof result.stopReason === 'string' ? result.stopReason : 'end_turn'
    return ok({ stopReason })
  } catch (error) {
    return err(toProtocolError(error, '发送 prompt 失败'))
  } finally {
    activePromptSessionId = prevActiveSessionId
  }
}

export function cancelAcp(payload: { sessionId: string }): Result<void, AppError> {
  const a = requireAgent()
  if (!a.ok) return a
  try {
    void a.value.notify(methods.agent.session.cancel, { sessionId: payload.sessionId })
    return ok(undefined)
  } catch (error) {
    return err(toProtocolError(error, '取消失败'))
  }
}

export function disposeAllAcp(): void {
  // App 退出：整树杀干净，不保温
  void disconnectAcp(undefined, { killProcess: true })
  disposeAllAcpProcesses()
}
