import {
  accumulateSubsessionUpdate,
  ensureSubsessionSession,
  isSubsessionPrompting,
  resetSubsession,
  sendSubsessionPrompt,
  subsessionOwnsSessionFor,
} from '@/lib/agent/acp-subsession'

const QUIZ_PURPOSE = 'quiz'
const QUIZ_KEY = 'default'

// 轮转配置：空闲超过 2 小时，或完成 20 轮交互后，自动平滑轮转至新会话
const MAX_IDLE_TIME_MS = 2 * 60 * 60 * 1000
const MAX_PROMPT_COUNT = 20

function quizEnsureOptions() {
  return {
    purpose: QUIZ_PURPOSE,
    key: QUIZ_KEY,
    rotation: { idleMs: MAX_IDLE_TIME_MS, maxPrompts: MAX_PROMPT_COUNT },
  } as const
}

/**
 * 校验当前是否处于考官出题/判卷 Prompt 流转中
 */
export function isQuizPrompting(): boolean {
  return isSubsessionPrompting(QUIZ_PURPOSE)
}

/**
 * 校验当前 ACP sessionId 是否归属考官副会话
 */
export function quizOwnsSessionId(sessionId: string): boolean {
  return subsessionOwnsSessionFor(QUIZ_PURPOSE, sessionId)
}

/**
 * 收集考官副会话的流式增量（不进入右侧时间线）
 */
export function accumulateQuizSessionUpdate(
  sessionId: string,
  update: Record<string, unknown>,
): void {
  if (!quizOwnsSessionId(sessionId) && !isQuizPrompting()) return

  accumulateSubsessionUpdate(sessionId, update)
}

/**
 * 获取或按需轮转考官会话（单例持续会话 + 定期平滑轮转）。
 * 未连时先发直连信令再等（沿制卡同链路）；仍未就绪返回 null，
 * 调用方回诚实标注的离线启发式（行文必带"离线"字样，不许冒充 AI）。
 */
export async function getOrCreateQuizSessionId(): Promise<string | null> {
  const ensured = await ensureSubsessionSession(quizEnsureOptions())
  if ('error' in ensured) {
    resetSubsession(QUIZ_PURPOSE, QUIZ_KEY)
    return null
  }
  return ensured.sessionId
}

/**
 * 发送考官 Prompt 并等待真实大模型完成回复（完全隔离右侧时间线）
 */
export async function sendQuizPrompt(promptText: string): Promise<string | null> {
  const sent = await sendSubsessionPrompt(quizEnsureOptions(), promptText)
  if (sent.status !== 'ok') return null
  return sent.reply
}

/**
 * 手动强制重置并启动全新考官会话（清空短期记忆与上下文）
 */
export async function resetQuizSession(): Promise<string | null> {
  resetSubsession(QUIZ_PURPOSE, QUIZ_KEY)
  return getOrCreateQuizSessionId()
}
