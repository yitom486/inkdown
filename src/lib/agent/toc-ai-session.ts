import { acpApi } from '@/api/acp-api'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { isOk } from '@shared/core/result'
import { listPreferredConfigPatches } from '@/lib/agent/acp-config-preferences'
import { buildAcpPromptBlocks, type ComposerAttachment } from '@/lib/agent/acp-composer'
import { extractTextFromContent } from '@/stores/acp-chat-types'
import type { AcpConfigOption } from '@shared/types/acp'

/** 目录页原图（渲染端离屏渲染，供模型识图；无图片能力时自动退化纯文本） */
export interface TocPromptImage {
  base64: string
  mimeType: string
  /** 如 `toc-p8.png`，进附件名与日志 */
  name: string
}

/**
 * 目录 AI 整理专用副会话（考官会话同款无头模式）。
 * 与考官单例复用不同：每次整理新建一条——目录内容随书而变，
 * 复用会把上一本书的目录残留进上下文。
 */

let tocSessionId: string | null = null
let tocReplyBuffer = ''
let tocPrompting = false
/** 单调 prompt 序号：与 session 短 id 合成 operationId（审计日志关联一次整理） */
let tocPromptSeq = 0

export function isTocPrompting(): boolean {
  return tocPrompting
}

/** 当前 Agent 是否接受图片（决定整理时附不附目录页原图） */
export function canTocUseImages(): boolean {
  return useAcpUiStore.getState().promptCapabilities.image === true
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

export type TocPromptSendOutcome = 'ok' | 'empty' | 'timeout' | 'error'

export interface TocPromptSendResult {
  /** 累积正文（可能为空字符串）；发送失败时为 null */
  reply: string | null
  /**
   * 发送结局：ok（有正文）/ empty（成功但零正文，工具可能已跑）/
   * timeout（客户端计时器先响且不发 cancel，服务端大概率仍在跑——草稿稍后到）/
   * error（发送前失败，重试等待无意义）。
   * 只有 timeout/empty 才值得等待工具草稿。
   */
  outcome: TocPromptSendOutcome
  elapsedMs: number
  /** 单调操作 id（审计日志关联一次整理） */
  opId: string
}

export interface TocPromptSendOptions {
  /** 当前书指纹：只取尾部进日志（全路径不落日志） */
  fingerprint?: string
}

/**
 * 发送目录整理 Prompt 并等待完成（调用方再做 JSON 解析与校验）。
 * 图片经 buildAcpPromptBlocks 组装：Agent 无 image 能力时自动只剩文本，
 * 调用方据此把提示词切到纯文本口径（见 buildTocAiPrompt withImages）。
 */
export async function sendTocPrompt(
  promptText: string,
  images?: readonly TocPromptImage[],
  options?: TocPromptSendOptions,
): Promise<TocPromptSendResult> {
  const opId = `${tocSessionId?.slice(0, 8) ?? 'nosession'}-${(tocPromptSeq += 1)}`
  const fpTail =
    options?.fingerprint && options.fingerprint.length > 24
      ? `…${options.fingerprint.slice(-24)}`
      : (options?.fingerprint ?? '')
  if (!tocSessionId) {
    return { reply: null, outcome: 'error', elapsedMs: 0, opId }
  }
  tocReplyBuffer = ''
  tocPrompting = true
  const shortSid = tocSessionId.slice(0, 8)
  const attachments: ComposerAttachment[] = (images ?? []).map((image, index) => ({
    id: `toc-img-${index}`,
    kind: 'image',
    name: image.name,
    mimeType: image.mimeType,
    base64: image.base64,
  }))
  const caps = useAcpUiStore.getState().promptCapabilities
  const blocks = buildAcpPromptBlocks({ text: promptText, attachments, promptCapabilities: caps })
  const imageCount = blocks.filter((block) => block.type === 'image').length
  console.info(
    `[toc-ai] prompt:start op=${opId} session=${shortSid} fp=${fpTail} chars=${promptText.length} images=${imageCount}/${attachments.length}`,
  )
  const startedAt = Date.now()
  try {
    const result = await acpApi.prompt({
      sessionId: tocSessionId,
      prompt: blocks,
    })
    const elapsedMs = Date.now() - startedAt
    if (!isOk(result)) {
      const outcome: TocPromptSendOutcome =
        result.error.code === 'ACP_TIMEOUT' ? 'timeout' : 'error'
      console.info(
        `[toc-ai] send:return op=${opId} outcome=${outcome} elapsedMs=${elapsedMs} error=${result.error.message}`,
      )
      return { reply: null, outcome, elapsedMs, opId }
    }
    const reply = tocReplyBuffer.trim()
    const outcome: TocPromptSendOutcome = reply ? 'ok' : 'empty'
    console.info(
      `[toc-ai] send:return op=${opId} outcome=${outcome} elapsedMs=${elapsedMs} replyChars=${reply.length} stop=${result.value.stopReason ?? 'ok'}`,
    )
    return { reply, outcome, elapsedMs, opId }
  } catch (cause) {
    const elapsedMs = Date.now() - startedAt
    console.info(
      `[toc-ai] send:return op=${opId} outcome=error elapsedMs=${elapsedMs} error=${cause instanceof Error ? cause.message : String(cause)}`,
    )
    return { reply: null, outcome: 'error', elapsedMs, opId }
  } finally {
    tocPrompting = false
  }
}

/**
 * 尽力取消某次整理的目录副会话（放弃等待时止血）。
 * 传本次 run 的 sid：新一轮可能已建新会话，误杀不得。
 * 失败静默（会话可能已结束），调用方 fire-and-forget。
 */
export async function cancelTocPrompt(sessionId?: string | null): Promise<void> {
  const sid = sessionId ?? tocSessionId
  if (!sid) return
  try {
    await acpApi.cancel({ sessionId: sid })
  } catch {
    // 止血尽力而为，取消失败不影响调用方流程
  }
}

export function resetTocSession(): void {
  tocSessionId = null
  tocReplyBuffer = ''
  tocPrompting = false
}
