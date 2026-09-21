import type { ReadingMark } from '@inkdown/contracts'

/**
 * 卡片↔正文联动通用决策层（与文件格式无关）。
 *
 * 职责边界：
 * - 本模块只做决策：从 mark 规划 reveal 策略序列、按序执行、结构化上报 miss。
 *   不碰 DOM、不调 view、不吞错——执行失败一律落在返回值里，由调用方记日志。
 * - 几何执行（goTo CFI / 翻页描框 / 锚点滚动）由各端 RevealAdapter 实现，
 *   三端 thin 化之后只剩原语，策略顺序与兜底规则收归此处。
 *
 * 策略顺序（精确 → 粗粒度 → 文本兜底）：
 * - epub：cfi（cfiRange 优先）→ excerpt
 * - mobi：cfi → chapter → excerpt（现状 Foliate 有 cfi 时失败即停，本规划允许继续兜底）
 * - pdf：page → excerpt（页内描框/闪光是适配器的事，用 quads 或重搜由适配器定）
 * - web：url（+headingId）→ excerpt
 */

/** 与格式无关的 reveal 策略步骤。 */
export type RevealStep =
  | { type: 'cfi'; cfi: string }
  | { type: 'mobi-chapter'; chapterId: string }
  | { type: 'pdf-page'; page: number }
  | { type: 'web-url'; url: string; headingId?: string }
  | { type: 'excerpt'; text: string }

/** 规范化摘录：卡片正文优先，锚点原文次之；空白一律视为无摘录。 */
export function revealExcerptOf(mark: ReadingMark): string | null {
  const text = mark.excerpt?.trim() || mark.anchor.selectedText?.trim() || ''
  return text ? text : null
}

/** 为一张卡片规划 reveal 策略序列（至少 0 步；空计划意味着连页都定不到）。 */
export function planReveal(mark: ReadingMark): RevealStep[] {
  const steps: RevealStep[] = []
  const anchor = mark.anchor
  switch (anchor.format) {
    case 'epub': {
      const cfi = anchor.cfiRange ?? anchor.cfi
      if (cfi) steps.push({ type: 'cfi', cfi })
      break
    }
    case 'mobi': {
      const cfi = anchor.cfiRange ?? anchor.cfi
      if (cfi) steps.push({ type: 'cfi', cfi })
      if (anchor.chapterId) steps.push({ type: 'mobi-chapter', chapterId: anchor.chapterId })
      break
    }
    case 'pdf': {
      steps.push({ type: 'pdf-page', page: anchor.page })
      break
    }
    case 'web': {
      steps.push({ type: 'web-url', url: anchor.url, headingId: anchor.headingId })
      break
    }
  }
  const excerpt = revealExcerptOf(mark)
  if (excerpt) steps.push({ type: 'excerpt', text: excerpt })
  return steps
}

/** 各端几何适配器：执行单步，返回是否定位成功（抛错视为本步失败，不中断后续兜底）。 */
export interface RevealAdapter {
  tryStep(step: RevealStep, mark: ReadingMark): boolean | Promise<boolean>
}

export interface RevealStepAttempt {
  step: RevealStep
  ok: boolean
  error?: string
}

export interface LinkageMiss {
  reason: 'empty-plan' | 'all-steps-failed'
  markId: string
}

export type RevealResult =
  | { ok: true; step: RevealStep; attempts: RevealStepAttempt[] }
  | { ok: false; attempts: RevealStepAttempt[]; miss: LinkageMiss }

/** 按规划依次执行，首个成功即停；全败返回结构化 miss（调用方记日志，禁止静默）。 */
export async function runRevealPlan(
  mark: ReadingMark,
  adapter: RevealAdapter,
): Promise<RevealResult> {
  const plan = planReveal(mark)
  const attempts: RevealStepAttempt[] = []
  if (plan.length === 0) {
    return { ok: false, attempts, miss: { reason: 'empty-plan', markId: mark.id } }
  }
  for (const step of plan) {
    try {
      const ok = await adapter.tryStep(step, mark)
      attempts.push({ step, ok })
      if (ok) return { ok: true, step, attempts }
    } catch (error) {
      attempts.push({
        step,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { ok: false, attempts, miss: { reason: 'all-steps-failed', markId: mark.id } }
}

/**
 * overlay 键（与 foliate apply 侧一致；书签无可视层，不进 overlay）。
 * 原 FoliateReaderViewer 私有实现，收归此处——正文命中 key→mark 必须单口径。
 */
export function overlayerKeyForMark(mark: ReadingMark): string | null {
  if (mark.kind === 'bookmark') return null
  const anchor = mark.anchor
  if (anchor.format === 'epub') return anchor.cfiRange ?? anchor.cfi ?? null
  if (anchor.format === 'mobi') return anchor.cfiRange ?? anchor.cfi ?? null
  return null
}

/** overlay 命中 key 反查 mark；无匹配返回 undefined（调用方判定 miss，不抛错）。 */
export function findMarkByOverlayerKey(
  marks: ReadingMark[],
  key: string,
): ReadingMark | undefined {
  return marks.find((mark) => overlayerKeyForMark(mark) === key)
}
