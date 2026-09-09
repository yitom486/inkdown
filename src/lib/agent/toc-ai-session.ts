import { acpApi } from '@/api/acp-api'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { isOk } from '@shared/core/result'
import { listPreferredConfigPatches } from '@/lib/agent/acp-config-preferences'
import { extractTextFromContent } from '@/stores/acp-chat-types'
import type { AcpConfigOption } from '@shared/types/acp'

/**
 * 目录 AI 整理专用副会话（考官会话同款无头模式）。
 * 与考官单例复用不同：每次整理新建一条——目录内容随书而变，
 * 复用会把上一本书的目录残留进上下文。
 */

let tocSessionId: string | null = null
let tocReplyBuffer = ''
let tocPrompting = false

export function isTocPrompting(): boolean {
  return tocPrompting
}

export function tocOwnsSessionId(sessionId: string): boolean {
  if (!tocSessionId) return false
  return tocSessionId === sessionId.trim()
}

/** 收集目录副会话的流式增量（不进入右侧时间线） */
export function accumulateTocSessionUpdate(
  sessionId: string,
  update: Record<string, unknown>,
): void {
  if (!tocOwnsSessionId(sessionId) && !tocPrompting) return
  const text = extractTextFromContent(update.content)
  if (text) {
    tocReplyBuffer += text
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

export interface TocModelOverride {
  configId: string
  value: string
}

/** 模型 / 思考档下拉的数据源：从 session 下发的 configOptions 里按类别挑 */
export function pickTocModelOptions(
  options: readonly AcpConfigOption[],
): AcpConfigOption[] {
  return options.filter(
    (o) =>
      o.type === 'select' &&
      (o.category === 'model' || /model/i.test(`${o.configId} ${o.name}`)),
  )
}

export function pickTocThoughtOptions(
  options: readonly AcpConfigOption[],
): AcpConfigOption[] {
  return options.filter(
    (o) =>
      o.type === 'select' &&
      (o.category === 'thought_level' ||
        /thought|reason|effort/i.test(`${o.configId} ${o.name}`)),
  )
}

function findRunnableOverride(
  options: readonly AcpConfigOption[],
  override: TocModelOverride | undefined,
): TocModelOverride | null {
  if (!override || !override.configId || override.value === '') return null
  const opt = options.find((o) => o.configId === override.configId)
  if (!opt) return null
  if (opt.options && opt.options.length > 0) {
    const allowed = opt.options.some((o) => o.value === override.value)
    if (!allowed) return null
  }
  const current =
    opt.currentValue === undefined || opt.currentValue === null
      ? ''
      : String(opt.currentValue)
  if (current === override.value) return null
  return override
}

/**
 * 新建目录整理会话：先套用户偏好，再套调用方显式选择（模型/思考档）。
 * 返回应用后的完整 configOptions，供 UI 回显实际生效值。
 */
export async function ensureTocSessionId(overrides?: {
  model?: TocModelOverride
  thought?: TocModelOverride
}): Promise<{ sessionId: string; configOptions: AcpConfigOption[] } | null> {
  const acpState = useAcpUiStore.getState()
  if (acpState.status !== 'connected') return null

  const created = await acpApi.sessionNew({ cwd: resolvePreferredAgentCwd(), toolScope: 'toc' })
  if (!isOk(created)) return null
  const sid = created.value.sessionId
  let options = created.value.configOptions ?? []

  const runtimeId = useAcpUiStore.getState().selectedRuntimeId
  const preferred = useAcpUiStore.getState().preferredConfigByRuntime[runtimeId] ?? undefined
  const patches = listPreferredConfigPatches(options, preferred)
  for (const extra of [overrides?.model, overrides?.thought]) {
    const runnable = findRunnableOverride(options, extra)
    if (runnable) patches.push(runnable)
  }
  // 显式选择后赢：同 configId 去重，保留最后一个
  const deduped = new Map<string, string>()
  for (const patch of patches) deduped.set(patch.configId, patch.value)
  for (const [configId, value] of deduped) {
    const applied = await acpApi.setConfigOption({ sessionId: sid, configId, value })
    if (isOk(applied)) options = applied.value.configOptions
  }

  tocSessionId = sid
  return { sessionId: sid, configOptions: options }
}

/** 发送目录整理 Prompt 并等待完成，返回累积正文（调用方再做 JSON 解析与校验） */
export async function sendTocPrompt(promptText: string): Promise<string | null> {
  if (!tocSessionId) return null
  tocReplyBuffer = ''
  tocPrompting = true
  const shortSid = tocSessionId.slice(0, 8)
  console.info(`[toc-ai] prompt session=${shortSid} chars=${promptText.length}`)
  try {
    const result = await acpApi.prompt({
      sessionId: tocSessionId,
      prompt: [{ type: 'text', text: promptText }],
    })
    if (!isOk(result)) {
      console.info(`[toc-ai] prompt failed session=${shortSid}: ${result.error.message}`)
      return null
    }
    const reply = tocReplyBuffer.trim()
    console.info(`[toc-ai] reply session=${shortSid} chars=${reply.length} stop=${result.value.stopReason ?? 'ok'}`)
    return reply
  } finally {
    tocPrompting = false
  }
}

export function resetTocSession(): void {
  tocSessionId = null
  tocReplyBuffer = ''
  tocPrompting = false
}
