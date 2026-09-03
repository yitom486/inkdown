import { acpApi } from '@/api/acp-api'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { isOk } from '@shared/core/result'
import { listPreferredConfigPatches } from '@/lib/agent/acp-config-preferences'
import { extractTextFromContent } from '@/stores/acp-chat-types'

interface QuizSessionState {
  sessionId: string | null
  createdAt: number
  lastUsedAt: number
  promptCount: number
}

// 持续性单例考官会话状态
const sessionState: QuizSessionState = {
  sessionId: null,
  createdAt: 0,
  lastUsedAt: 0,
  promptCount: 0,
}

// 轮转配置：空闲超过 2 小时，或完成 20 轮交互后，自动平滑轮转至新会话
const MAX_IDLE_TIME_MS = 2 * 60 * 60 * 1000
const MAX_PROMPT_COUNT = 20

// 当前流式回复累加器
let currentReplyBuffer = ''
let activePrompting = false

/**
 * 校验当前是否处于考官出题/判卷 Prompt 流转中
 */
export function isQuizPrompting(): boolean {
  return activePrompting
}

/**
 * 校验当前 ACP sessionId 是否归属考官副会话
 */
export function quizOwnsSessionId(sessionId: string): boolean {
  if (!sessionState.sessionId) return false
  return sessionState.sessionId === sessionId.trim()
}

/**
 * 收集考官副会话的流式增量（不进入右侧时间线）
 */
export function accumulateQuizSessionUpdate(
  sessionId: string,
  update: Record<string, unknown>,
): void {
  if (!quizOwnsSessionId(sessionId) && !activePrompting) return

  const text = extractTextFromContent(update.content)
  if (text) {
    currentReplyBuffer += text
  }
}

function resolvePreferredAgentCwd(): string | undefined {
  const s = useAcpUiStore.getState()
  const active = s.threads.find((t) => t.id === s.activeThreadId)
  const fromActive = active?.workspaceRoot?.trim()
  if (fromActive) return fromActive
  for (const thread of s.threads) {
    const root = thread.workspaceRoot?.trim()
    if (root) return root
  }
  return undefined
}

/**
 * 获取或按需轮转考官会话（单例持续会话 + 定期平滑轮转）
 */
export async function getOrCreateQuizSessionId(): Promise<string | null> {
  let acpState = useAcpUiStore.getState()
  if (acpState.status === 'connecting') {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100))
      acpState = useAcpUiStore.getState()
      if (acpState.status === 'connected') break
      if (acpState.status === 'error' || acpState.status === 'disconnected') break
    }
  }

  if (acpState.status !== 'connected') {
    sessionState.sessionId = null
    return null
  }

  const now = Date.now()
  const isExpired =
    !sessionState.sessionId ||
    now - sessionState.lastUsedAt > MAX_IDLE_TIME_MS ||
    sessionState.promptCount >= MAX_PROMPT_COUNT

  if (!isExpired && sessionState.sessionId) {
    sessionState.lastUsedAt = now
    return sessionState.sessionId
  }

  // 轮转启用新会话
  const cwd = resolvePreferredAgentCwd()
  const created = await acpApi.sessionNew({ cwd })
  if (!isOk(created)) {
    return null
  }

  const sid = created.value.sessionId
  sessionState.sessionId = sid
  sessionState.createdAt = now
  sessionState.lastUsedAt = now
  sessionState.promptCount = 0

  // 继承右侧用户的模型与配置偏好 (Model / Mode)
  const runtimeId = acpState.selectedRuntimeId
  const preferred = acpState.preferredConfigByRuntime[runtimeId] ?? undefined
  const patches = listPreferredConfigPatches(created.value.configOptions ?? [], preferred)
  for (const patch of patches) {
    await acpApi.setConfigOption({
      sessionId: sid,
      configId: patch.configId,
      value: patch.value,
    })
  }

  return sid
}

/**
 * 发送考官 Prompt 并等待真实大模型完成回复（完全隔离右侧时间线）
 */
export async function sendQuizPrompt(promptText: string): Promise<string | null> {
  const sid = await getOrCreateQuizSessionId()
  if (!sid) return null

  currentReplyBuffer = ''
  sessionState.promptCount++
  sessionState.lastUsedAt = Date.now()
  activePrompting = true

  try {
    const result = await acpApi.prompt({
      sessionId: sid,
      prompt: [{ type: 'text', text: promptText }],
    })

    if (!isOk(result)) {
      return null
    }

    return currentReplyBuffer.trim()
  } finally {
    activePrompting = false
  }
}

/**
 * 手动强制重置并启动全新考官会话（清空短期记忆与上下文）
 */
export async function resetQuizSession(): Promise<string | null> {
  sessionState.sessionId = null
  sessionState.promptCount = 0
  sessionState.lastUsedAt = 0
  currentReplyBuffer = ''
  return getOrCreateQuizSessionId()
}
