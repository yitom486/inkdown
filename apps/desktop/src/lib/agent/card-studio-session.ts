import { acpApi } from '@/api/acp-api'
import { aiSessionApi } from '@/api/ai-session-api'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { isOk } from '@inkdown/contracts'
import { listPreferredConfigPatches } from '@/lib/agent/acp-config-preferences'
import { extractTextFromContent } from '@/stores/acp-chat-types'

/**
 * AI 制卡一书一会话（P1，见 `.plan/ai-cards/01-card-studio-plan.md`）。
 * 指针落 `inkdown.db ai_sessions`（重启不失）；轮转阈值沿 quiz 副会话
 *（2h 空闲 / 20 轮）；复用走 `loadSession(secondary)`，失败回 `session/new`。
 */

const ROTATE_IDLE_MS = 2 * 60 * 60 * 1000
const ROTATE_PROMPT_COUNT = 20

interface CardStudioEntry {
  sessionId: string
  promptCount: number
  lastUsedAt: number
  replyBuffer: string
  prompting: boolean
  /** 本进程内新建（无需 load）；DB 里捞回来的是 false，复用前先 load */
  fresh: boolean
}

const entries = new Map<string, CardStudioEntry>()

function entryFor(bookKey: string): CardStudioEntry | null {
  return entries.get(bookKey) ?? null
}

export function cardStudioOwnsSessionId(sessionId: string): boolean {
  const sid = sessionId.trim()
  if (!sid) return false
  for (const entry of entries.values()) {
    if (entry.sessionId === sid) return true
  }
  return false
}

export function isCardStudioPrompting(): boolean {
  for (const entry of entries.values()) {
    if (entry.prompting) return true
  }
  return false
}

/** 收集制卡副会话的流式增量（不进入右侧时间线，沿 quiz/toc 同模式） */
export function accumulateCardStudioSessionUpdate(
  sessionId: string,
  update: Record<string, unknown>,
): void {
  const sid = sessionId.trim()
  for (const entry of entries.values()) {
    if (entry.sessionId !== sid && !entry.prompting) continue
    const text = extractTextFromContent(update.content)
    if (text) entry.replyBuffer += text
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

async function waitForConnected(): Promise<boolean> {
  let acpState = useAcpUiStore.getState()
  if (acpState.status === 'connecting') {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100))
      acpState = useAcpUiStore.getState()
      if (acpState.status === 'connected') break
      if (acpState.status === 'error' || acpState.status === 'disconnected') break
    }
  }
  return acpState.status === 'connected'
}

async function createSession(bookKey: string): Promise<string | null> {
  const created = await acpApi.sessionNew({ cwd: resolvePreferredAgentCwd() })
  if (!isOk(created)) return null
  const sid = created.value.sessionId
  const runtimeId = useAcpUiStore.getState().selectedRuntimeId
  const preferred = useAcpUiStore.getState().preferredConfigByRuntime[runtimeId] ?? undefined
  const patches = listPreferredConfigPatches(created.value.configOptions ?? [], preferred)
  for (const patch of patches) {
    await acpApi.setConfigOption({ sessionId: sid, configId: patch.configId, value: patch.value })
  }
  const now = Date.now()
  entries.set(bookKey, {
    sessionId: sid,
    promptCount: 0,
    lastUsedAt: now,
    replyBuffer: '',
    prompting: false,
    fresh: true,
  })
  await aiSessionApi.put({
    bookFingerprint: bookKey,
    sessionId: sid,
    promptCount: 0,
    lastUsedAt: now,
  })
  return sid
}

/**
 * 取本书制卡会话：内存命中且未过期即用；否则读库复用（load），
 * 恢复失败或计数/超时到期则新建。未连接返回 null（调用方回落启发式）。
 */
export async function getOrCreateCardStudioSessionId(bookKey: string): Promise<string | null> {
  if (!(await waitForConnected())) return null
  const now = Date.now()
  const existing = entryFor(bookKey)
  if (
    existing &&
    now - existing.lastUsedAt <= ROTATE_IDLE_MS &&
    existing.promptCount < ROTATE_PROMPT_COUNT
  ) {
    existing.lastUsedAt = now
    return existing.sessionId
  }

  const stored = await aiSessionApi.get({ bookFingerprint: bookKey })
  const row = isOk(stored) ? stored.value : null
  if (
    row &&
    now - row.lastUsedAt <= ROTATE_IDLE_MS &&
    row.promptCount < ROTATE_PROMPT_COUNT
  ) {
    const loaded = await acpApi.loadSession({
      sessionId: row.sessionId,
      cwd: resolvePreferredAgentCwd(),
      secondary: true,
    })
    if (isOk(loaded)) {
      entries.set(bookKey, {
        sessionId: row.sessionId,
        promptCount: row.promptCount,
        lastUsedAt: now,
        replyBuffer: '',
        prompting: false,
        fresh: false,
      })
      return row.sessionId
    }
  }
  return createSession(bookKey)
}

/**
 * 经本书会话发制卡 prompt。
 * 结局：ok（有正文）/ offline（ACP 未连接）/ failed（建会话/发送/恢复失败）。
 * 成功（无论正文空否）记一次 touch；旧会话已死自转一次重试。
 * 每次关键节点打 console.info（[card-studio]，devtools 可查；不记原文与指纹全文）。
 */
export type CardStudioSendStatus = 'ok' | 'offline' | 'failed'

export interface CardStudioSendResult {
  status: CardStudioSendStatus
  reply: string
}

export async function sendCardStudioPrompt(
  bookKey: string,
  promptText: string,
): Promise<CardStudioSendResult> {
  if (!(await waitForConnected())) {
    console.info(`[card-studio] send:abort book=${bookKey.slice(-8)} reason=offline`)
    return { status: 'offline', reply: '' }
  }
  const first = await getOrCreateCardStudioSessionId(bookKey)
  if (!first) {
    console.info(`[card-studio] send:abort book=${bookKey.slice(-8)} reason=session-new-failed`)
    return { status: 'failed', reply: '' }
  }
  const reply = await promptOnce(bookKey, first, promptText)
  if (reply !== null) {
    await aiSessionApi.touch({ bookFingerprint: bookKey })
    console.info(
      `[card-studio] send:return book=${bookKey.slice(-8)} outcome=ok replyChars=${reply.length}`,
    )
    return { status: 'ok', reply }
  }
  // 自转重试一次（覆盖"库里有、运行时侧已死"的重启后首次调用）
  console.info(`[card-studio] send:retry book=${bookKey.slice(-8)} reason=prompt-rejected`)
  entries.delete(bookKey)
  const second = await createSession(bookKey)
  if (!second) {
    console.info(`[card-studio] send:abort book=${bookKey.slice(-8)} reason=rotate-failed`)
    return { status: 'failed', reply: '' }
  }
  const retried = await promptOnce(bookKey, second, promptText)
  if (retried !== null) {
    await aiSessionApi.touch({ bookFingerprint: bookKey })
    console.info(
      `[card-studio] send:return book=${bookKey.slice(-8)} outcome=ok-after-rotate replyChars=${retried.length}`,
    )
    return { status: 'ok', reply: retried }
  }
  console.info(`[card-studio] send:return book=${bookKey.slice(-8)} outcome=failed`)
  return { status: 'failed', reply: '' }
}

async function promptOnce(
  bookKey: string,
  sessionId: string,
  promptText: string,
): Promise<string | null> {
  const entry = entryFor(bookKey)
  if (!entry || entry.sessionId !== sessionId) return null
  entry.replyBuffer = ''
  entry.prompting = true
  try {
    const result = await acpApi.prompt({
      sessionId,
      prompt: [{ type: 'text', text: promptText }],
    })
    if (!isOk(result)) return null
    entry.promptCount += 1
    entry.lastUsedAt = Date.now()
    return entry.replyBuffer.trim()
  } finally {
    entry.prompting = false
  }
}

/** 手动新开会话（对话框"新开会话"按钮）：清内存，下一调用建新行覆盖 */
export function resetCardStudioSession(bookKey: string): void {
  entries.delete(bookKey)
}

/** 仅单测用 */
export function clearCardStudioSessions(): void {
  entries.clear()
}
