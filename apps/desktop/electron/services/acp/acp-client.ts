import { app } from 'electron'
import {
  ANTIGRAVITY_ACP_RUNTIME_ID,
  APP_TITLE,
  DEFAULT_ACP_RUNTIME_ID,
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
  InkdownSnapshotArgs,
  InkdownSnapshotResource,
} from '@inkdown/contracts'
import { getAcpRuntime } from '@inkdown/acp'
import { resolveAgentCwd } from './agent-sandbox-cwd'
import { parseAcpConfigOptions } from '@inkdown/acp'
import {
  createAcpClientMethodRouter,
  pickAllowOptionId,
  type PermissionDecision,
} from './client-handlers'
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
import {
  isJsonRpcNotification,
  isJsonRpcRequest,
  JsonRpcTransport,
} from '@inkdown/acp'
import { disposeAllAcpProcesses, getLiveAcpProcess, isSpawnedAcpProcessAlive, spawnAcpProcess, type SpawnedAcpProcess } from './process-manager'
import { ensureBunForCommand, mapSpawnErrorToAppError } from '../bun-runtime'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sweepStaleAntigravityTempDirs } from './antigravity-temp-sweep'

const PROTOCOL_VERSION = 1

/** 非 codex-acp 运行时的中性 preflight：无本地登录痕迹 → gate 走协议 authMethods 弹向导 */
const NEUTRAL_AUTH_PREFLIGHT: AcpAuthPreflightResult = {
  codexHome: '',
  hasCodexHome: false,
  hasAuthFile: false,
  hasApiKeyEnv: false,
  looksLoggedIn: false,
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

let transport: JsonRpcTransport | null = null
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
/** 防止连点「连接」时旧 disconnect 拆掉新 transport */
let connectGeneration = 0
let cachedAgentName: string | undefined
let cachedAgentVersion: string | undefined
let cachedProtocolVersion = PROTOCOL_VERSION
let status: AcpConnectionStatus = 'disconnected'
let permissionBridge: AcpPermissionBridge | null = null
let snapshotBridge: AcpSnapshotBridge | null = null
let snapshotRequestSeq = 0
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

const pendingPermissions = new Map<number, { resolve: (value: PermissionDecision) => void }>()
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

function requireTransport(allowAuthPhase = false): Result<JsonRpcTransport, AppError> {
  if (!transport) {
    return err({ code: 'ACP_NOT_CONNECTED', message: 'ACP Agent 未连接' })
  }
  if (status === 'connected') return ok(transport)
  if (allowAuthPhase && (status === 'connecting' || status === 'awaiting_auth')) {
    return ok(transport)
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
  const t = requireTransport(true)
  if (!t.ok) return t
  if (!runtimeId) {
    return err({ code: 'ACP_NOT_CONNECTED', message: '运行时未知' })
  }

  const resumeId = pendingResumeSessionId?.trim() || null

  try {
    const opened = await restoreOrCreateAcpSession({
      request: (method, params) => t.value.request(method, params),
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
  console.info('[acp] handlePermissionRequest', {
    requestId,
    numericId,
    hasBridge: Boolean(permissionBridge),
    optionCount: Array.isArray(params.options) ? params.options.length : 0,
  })
  if (!permissionBridge || !Number.isFinite(numericId)) {
    const fallback = await resolvePermission(params)
    console.warn('[acp] permissionBridge 不可用，自动决议（不会弹出审批 UI）', {
      requestId,
      fallback,
    })
    return fallback
  }

  return await new Promise<PermissionDecision>((resolve) => {
    pendingPermissions.set(numericId, { resolve })
    const permSessionId =
      typeof params.sessionId === 'string' && params.sessionId.trim()
        ? params.sessionId
        : (sessionId ?? undefined)
    void permissionBridge!({
      requestId: numericId,
      sessionId: permSessionId,
      params,
    })
      .then((outcome) => {
        if (!pendingPermissions.has(numericId)) return
        pendingPermissions.delete(numericId)
        console.info('[acp] permissionBridge 返回', { requestId: numericId, outcome })
        resolve(outcome)
      })
      .catch((error) => {
        if (!pendingPermissions.has(numericId)) return
        pendingPermissions.delete(numericId)
        console.error('[acp] permissionBridge 异常，cancelled', error)
        resolve({ outcome: 'cancelled' })
      })
  })
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
  const runtime = getAcpRuntime(payload.runtimeId)
  if (!runtime) {
    return err({ code: 'ACP_SPAWN_ERROR', message: `未知运行时: ${payload.runtimeId}` })
  }

  const gen = ++connectGeneration
  console.info('[acp] connect start', {
    gen,
    runtimeId: payload.runtimeId,
    resumeSessionId: payload.resumeSessionId,
  })

  // 常驻复用：同 runtime 有存活温进程时跳过冷启动（省掉 PyInstaller 解压 +
  // Python 导包，antigravity 一次冷启动可达数十秒）。温进程是否健康由后面的
  // initialize 握手验证；若握手失败，catch 会杀掉毒进程，下次点击走冷启动自愈。
  const warmHandle = getLiveAcpProcess(runtime.id)
  if (warmHandle) {
    // 剥离旧会话状态但保温进程：旧 transport 只摘监听，不关 stdio。
    await disconnectAcp()
    processHandle = warmHandle
  } else {
    await disconnectAcp(undefined, { killProcess: true })
    // 给旧进程/stdio 一点时间收尾，降低「传输已销毁」竞态
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
  if (gen !== connectGeneration) {
    return err({ code: 'ACP_PROTOCOL_ERROR', message: '连接已被更新的请求取代' })
  }

  runtimeId = runtime.id
  pendingResumeSessionId = payload.resumeSessionId?.trim() || null
  setStatus('connecting')

  const adapter = getAcpRuntimeAdapter(runtime.id)

  if (runtime.id === ANTIGRAVITY_ACP_RUNTIME_ID) {
    const agy = adapter.findServer ? adapter.findServer() : null
    if (!agy) {
      setStatus('error', '未检测到 Google Antigravity 服务端')
      return err({
        code: 'ACP_SPAWN_ERROR',
        message:
          '未检测到 Google Antigravity 服务端（agy_acp_server）。请确保本机已安装 Zed Antigravity 扩展，或设置环境变量 AGY_ACP_SERVER_PATH 指向可执行文件。',
      })
    }
  }

  // 启动前钩子：例如 Antigravity 自动桥接 Windows 凭据管理器，无感同步 refresh_token
  if (adapter.beforeSpawn) {
    await adapter.beforeSpawn()
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

  // 代理环境变量：优先委托 adapter，未声明则走通用 acp-proxy
  const proxySettings = await readAcpProxySettings()
  const proxyResult = adapter.getSpawnEnv
    ? adapter.getSpawnEnv(proxySettings)
    : buildAcpProxySpawnEnv(proxySettings)

  // 自定义供应商模式（Codex 等）：隔离 CODEX_HOME + 注入 Key
  let customProviderEnv: NodeJS.ProcessEnv = {}
  if (adapter.getCustomProvider) {
    const custom = await adapter.getCustomProvider()
    customProviderEnv = custom.customEnv
  }

  try {
    if (!warmHandle && runtime.id === ANTIGRAVITY_ACP_RUNTIME_ID) {
      // 冷启动前清扫已死进程的 _MEI/.tmp 残留。
      // 温进程与 Zed 共存实例的目录因新鲜（或被 DLL 锁占用）会被豁免。
      try {
        await sweepStaleAntigravityTempDirs()
      } catch {
        // 清扫失败不阻塞连接
      }
    }
    if (warmHandle) {
      // 温进程复用：跳过 spawn，直接用原 stdio 建新传输并走握手
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
      onStderrLine: (line) => {
        if (line.includes('https://accounts.google.com/o/oauth2/')) {
          console.info('[acp] agy_acp_server 正在进行 Google 授权')
        }
      },
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

    const localTransport = new JsonRpcTransport(child.stdout, child.stdin, {
      requestTimeoutMs: 120_000,
      onMessage: async (message) => {
        if (isJsonRpcRequest(message)) {
          const router = createAcpClientMethodRouter(
            localTransport,
            ({ requestId, params }) => handlePermissionRequest(requestId, params),
            {
              getWorkspaceRoot: () => workspaceRoot,
              terminals: terminalManager,
              readSnapshot: handleSnapshotRequest,
            },
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
    })) as Record<string, unknown>

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

    const agentInfo =
      initResult.agentInfo && typeof initResult.agentInfo === 'object'
        ? (initResult.agentInfo as Record<string, unknown>)
        : undefined
    cachedAgentName = typeof agentInfo?.name === 'string' ? agentInfo.name : undefined
    cachedAgentVersion = typeof agentInfo?.version === 'string' ? agentInfo.version : undefined

    const caps =
      initResult.agentCapabilities && typeof initResult.agentCapabilities === 'object'
        ? (initResult.agentCapabilities as Record<string, unknown>)
        : {}
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

    let authMethods = parseAuthMethods(initResult.authMethods)
    if (adapter.orderAuthMethods) {
      authMethods = adapter.orderAuthMethods(authMethods)
    }

    const preflight = adapter.probeAuth()
    let openedWithoutAuth: Extract<AcpConnectResult, { phase: 'ready' }> | null = null
    const gate = await runConnectAuthGate(authMethods, preflight, {
      // 本地已有凭据（codex 的 ~/.codex、antigravity 的 settings.json / 桥接 Token 等）
      // 时，一律优先直接建立会话（session/new）复用已有登录态，杜绝弹出系统浏览器
      preferDirectSession: true,
      authenticate: async (methodId) => {
        await localTransport.request('authenticate', { methodId })
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
  const t = requireTransport(true)
  if (!t.ok) return t
  const cwd = resolveAgentCwd(workspaceRoot).cwd

  const adapter = getAcpRuntimeAdapter(runtimeId ?? '')
  // 认证守门员逻辑（docs/antigravity_acp_auth_and_lifecycle.md 第 3.4 节）：
  // 官方 ACP 收到 authenticate 请求时无脑拉起系统浏览器；
  // 若本地已持有有效 Token，直接复用已有凭据建立会话，杜绝弹出系统浏览器
  if (adapter.canSkipInteractiveAuth?.(payload.methodId, payload.force)) {
    console.info('[acp] 认证守门员生效：本地凭据已就绪，跳过交互式 authenticate，直接建立会话')
    return await openSessionAfterAuth(cwd)
  }

  try {
    await t.value.request('authenticate', { methodId: payload.methodId })
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
  const t = requireTransport()
  if (!t.ok) return t
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
    const result = (await t.value.request('session/load', {
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
    })) as Record<string, unknown>
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
  for (const [, pending] of pendingPermissions) {
    pending.resolve({ outcome: 'cancelled' })
  }
  pendingPermissions.clear()

  terminalManager.releaseAll()

  transport?.dispose()
  transport = null

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
  const t = requireTransport()
  if (!t.ok) return t

  const resolvedCwd = resolveAgentCwd(cwd || workspaceRoot).cwd

  try {
    const mcpServers =
      toolScope === 'toc'
        ? mcpServerEntry(await ensureTocMcpServer(), 'inkdown-toc')
        : inkdownMcp
          ? mcpServerEntry(inkdownMcp, 'inkdown')
          : []
    const result = (await t.value.request('session/new', {
      cwd: resolvedCwd,
      mcpServers,
    })) as Record<string, unknown>
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
  const t = requireTransport()
  if (!t.ok) return t

  try {
    const result = (await t.value.request('session/set_config_option', {
      sessionId: payload.sessionId,
      configId: payload.configId,
      value: payload.value,
    })) as Record<string, unknown>
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
  const t = requireTransport()
  if (!t.ok) return t

  const prompt = Array.isArray(payload.prompt) ? payload.prompt : []
  if (prompt.length === 0) {
    return err({ code: 'ACP_PROTOCOL_ERROR', message: 'prompt 不能为空' })
  }

  const prevActiveSessionId = activePromptSessionId
  activePromptSessionId = payload.sessionId
  try {
    const result = (await t.value.request('session/prompt', {
      sessionId: payload.sessionId,
      prompt,
    })) as Record<string, unknown>
    const stopReason = typeof result.stopReason === 'string' ? result.stopReason : 'end_turn'
    return ok({ stopReason })
  } catch (error) {
    return err(toProtocolError(error, '发送 prompt 失败'))
  } finally {
    activePromptSessionId = prevActiveSessionId
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
  // App 退出：整树杀干净，不保温
  void disconnectAcp(undefined, { killProcess: true })
  disposeAllAcpProcesses()
}

/** 测试钩子：注入已构造的 transport（跳过 spawn） */
export function __setAcpTransportForTests(next: JsonRpcTransport | null, nextSessionId?: string): void {
  transport = next
  sessionId = nextSessionId ?? null
  status = next ? 'connected' : 'disconnected'
}
