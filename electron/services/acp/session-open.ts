import type { AcpSessionRestoreAttempt, AcpSessionRestoreMethod } from '@shared/types/acp'

export type AcpRpcRequest = (method: string, params?: unknown) => Promise<unknown>

export interface RestoreOrCreateSessionInput {
  request: AcpRpcRequest
  cwd: string
  resumeSessionId: string | null
  resumeSupported: boolean
  loadSupported: boolean
  /** session/load 回放期间回调（主进程用来压制 UI 更新） */
  onSuppressUpdates?: (suppress: boolean) => void
  /** 测试可设为 0 */
  retryDelayMs?: number
  log?: (level: 'info' | 'warn', message: string, data?: Record<string, unknown>) => void
}

export interface RestoreOrCreateSessionResult {
  sessionId: string
  configOptions: unknown
  restoreMethod: AcpSessionRestoreMethod
  sessionRestored: boolean
  requestedSessionId?: string
  restoreAttempts: AcpSessionRestoreAttempt[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isTransientAcpTransportError(message: string): boolean {
  return /传输已销毁|传输已关闭|stdio 已关闭|请求超时/.test(message)
}

/**
 * 优先 resume → load → session/new。
 * resume/load 对瞬时传输错误最多再试 1 次；失败明细写入 restoreAttempts。
 */
export async function restoreOrCreateAcpSession(
  input: RestoreOrCreateSessionInput,
): Promise<RestoreOrCreateSessionResult> {
  const resumeId = input.resumeSessionId?.trim() || null
  const restoreAttempts: AcpSessionRestoreAttempt[] = []
  const delayMs = input.retryDelayMs ?? 250
  const log =
    input.log ??
    ((level, message, data) => {
      const line = `[acp] ${message}`
      if (level === 'warn') console.warn(line, data ?? '')
      else console.info(line, data ?? '')
    })

  const tryRestoreMethod = async (
    method: 'resume' | 'load',
    rpcMethod: string,
  ): Promise<Record<string, unknown> | null> => {
    const maxTries = 2
    let lastError = ''
    for (let tryIndex = 1; tryIndex <= maxTries; tryIndex++) {
      log('info', 'session restore attempt', {
        method: rpcMethod,
        sessionId: resumeId,
        try: tryIndex,
        maxTries,
      })
      try {
        const result = (await input.request(rpcMethod, {
          sessionId: resumeId,
          cwd: input.cwd,
          mcpServers: [],
        })) as Record<string, unknown>
        restoreAttempts.push({ method, ok: true, tries: tryIndex })
        log('info', 'session restore ok', { method: rpcMethod, sessionId: resumeId })
        return result
      } catch (error) {
        lastError = errorMessage(error)
        log('warn', 'session restore failed', {
          method: rpcMethod,
          sessionId: resumeId,
          try: tryIndex,
          error: lastError,
        })
        const canRetry = tryIndex < maxTries && isTransientAcpTransportError(lastError)
        if (!canRetry) {
          restoreAttempts.push({ method, ok: false, tries: tryIndex, error: lastError })
          return null
        }
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
      }
    }
    restoreAttempts.push({ method, ok: false, tries: maxTries, error: lastError })
    return null
  }

  log('info', 'openSession', {
    resumeId,
    resumeSupported: input.resumeSupported,
    loadSupported: input.loadSupported,
  })

  if (resumeId && input.resumeSupported) {
    const resumed = await tryRestoreMethod('resume', 'session/resume')
    if (resumed) {
      const id = typeof resumed.sessionId === 'string' ? resumed.sessionId : resumeId
      return {
        sessionId: id,
        configOptions: resumed.configOptions,
        restoreMethod: 'resume',
        sessionRestored: true,
        requestedSessionId: resumeId,
        restoreAttempts,
      }
    }
  } else if (resumeId && !input.resumeSupported) {
    log('info', 'skip session/resume：Agent 未声明 resume 能力')
  }

  if (resumeId && input.loadSupported) {
    input.onSuppressUpdates?.(true)
    try {
      const loaded = await tryRestoreMethod('load', 'session/load')
      if (loaded) {
        const id = typeof loaded.sessionId === 'string' ? loaded.sessionId : resumeId
        return {
          sessionId: id,
          configOptions: loaded.configOptions,
          restoreMethod: 'load',
          sessionRestored: true,
          requestedSessionId: resumeId,
          restoreAttempts,
        }
      }
    } finally {
      input.onSuppressUpdates?.(false)
    }
  } else if (resumeId && !input.loadSupported) {
    log('info', 'skip session/load：Agent 未声明 loadSession 能力')
  }

  log('info', 'falling back to session/new', { resumeId, restoreAttempts })
  const sessionResult = (await input.request('session/new', {
    cwd: input.cwd,
    mcpServers: [],
  })) as Record<string, unknown>
  const newSessionId =
    typeof sessionResult.sessionId === 'string' ? sessionResult.sessionId : null
  if (!newSessionId) {
    throw new Error('session/new 未返回 sessionId')
  }

  return {
    sessionId: newSessionId,
    configOptions: sessionResult.configOptions,
    restoreMethod: 'new',
    sessionRestored: false,
    requestedSessionId: resumeId ?? undefined,
    restoreAttempts,
  }
}
