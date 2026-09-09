import type { InspectorSpanLike } from './ocr-page-words'

/**
 * 目录几何配对：用 OCR 行框坐标把右列页码钉回同行标题。
 *
 * 背景（王道书第 8 页实录）：页码在 markdown 里是乱序的——顶部 `2 2 3`
 * 被甩到所有标题前面（待配对队列为空，只能丢弃），`8 9 11…` 数量与标题
 * 对不上（1 标题对 7 个数，整批放弃）。但 spans 里它们全在：右列 x≈470，
 * 与标题同行（dy≤4，行距 14+），置信度多为 1.00。串行配对看不见这层信息。
 *
 * 约束（宁漏勿编）：
 * - 只配无 CJK 的纯数字碎片（取尾部数字串，如 `?25`→25），标题 span 须含 CJK
 *   且行首是章节号；两者缺一不配。
 * - 数字须过置信门（默认 0.85）：`?25`（0.80）这种相邻行串味碎片直接丢，
 *   哪怕它恰好落在某标题行容差内。
 * - 数字须过范围门（印刷页 + 偏移 ∈ [1, 总页数]），水印大数进不来。
 * - 一号一用：同一数字 span 只给 dy 最近的标题；同一章节取首次命中。
 * - 章标题（第X章，无数字章节号）不进映射——真目录章必带页码，
 *   无号即数字丢失，与启发式同策略丢弃。
 */

export interface TocGeometrySpan {
  text: string
  x: number
  y: number
  confidence: number
}

export interface TocGeometryOptions {
  /** 真实总页数（与 pageOffset 联动做范围门） */
  pageCount?: number
  /** 印刷页 + 偏移 = 真实页 */
  pageOffset?: number
  /** 数字碎片置信度下限，默认 0.85（串味碎片多在 0.8 附近） */
  minConfidence?: number
  /** 同行容差（PDF 点），默认 8（实测同行 dy≤4，行距 14+） */
  maxDy?: number
  /** 数字须在标题右方至少这么多点，默认 150（实测标题 x≤110，数字 x≥465） */
  minXGap?: number
}

export interface TocGeometryResult {
  /** 章节号 → 印刷页（如 `1.2.7`→8） */
  pages: Map<string, number>
  /** 配对成功的标题数 */
  paired: number
  /** 置信不足丢弃的数字碎片数 */
  droppedLowConf: number
  /** 超范围丢弃的数字碎片数 */
  droppedOutOfRange: number
}

const DEFAULT_MIN_CONFIDENCE = 0.85
const DEFAULT_MAX_DY = 8
const DEFAULT_MIN_X_GAP = 150

const CJK = /[\u4e00-\u9fff]/
const SECTION_HEAD = /^(\d+(?:\.\d+)*)/

function sectionOfSpanTitle(text: string): string | null {
  const match = SECTION_HEAD.exec(text.trim())
  return match ? (match[1] ?? null) : null
}

function inRange(page: number, options: TocGeometryOptions): boolean {
  if (options.pageCount == null || options.pageOffset == null) return true
  if (!Number.isFinite(options.pageCount) || !Number.isFinite(options.pageOffset)) return true
  const real = page + Math.round(options.pageOffset)
  return real >= 1 && real <= options.pageCount
}

export function buildSectionPageMap(
  spans: readonly TocGeometrySpan[] | readonly InspectorSpanLike[],
  options?: TocGeometryOptions,
): TocGeometryResult {
  const minConfidence = options?.minConfidence ?? DEFAULT_MIN_CONFIDENCE
  const maxDy = options?.maxDy ?? DEFAULT_MAX_DY
  const minXGap = options?.minXGap ?? DEFAULT_MIN_X_GAP
  const pages = new Map<string, number>()
  let paired = 0
  let droppedLowConf = 0
  let droppedOutOfRange = 0

  interface TitleRow {
    section: string
    x: number
    y: number
  }
  interface NumberFrag {
    page: number
    x: number
    y: number
    used: boolean
  }
  const titles: TitleRow[] = []
  const numbers: NumberFrag[] = []

  for (const span of spans) {
    if (!Number.isFinite(span.x) || !Number.isFinite(span.y)) continue
    if (CJK.test(span.text)) {
      const section = sectionOfSpanTitle(span.text)
      if (section) titles.push({ section, x: span.x, y: span.y })
      continue
    }
    // 同一框内多个数字（如 `8 9`）拆成独立碎片，各自按坐标配对
    const runs = span.text.match(/\d+/g)
    if (!runs || runs.length === 0) continue
    if (!(span.confidence >= minConfidence)) {
      droppedLowConf += runs.length
      continue
    }
    for (const run of runs) {
      const page = Number.parseInt(run, 10)
      if (!Number.isInteger(page) || page < 1) continue
      if (!inRange(page, options ?? {})) {
        droppedOutOfRange += 1
        continue
      }
      numbers.push({ page, x: span.x, y: span.y, used: false })
    }
  }

  // 全局最近匹配：全部候选（标题，数字，dy）按 dy 升序贪心，一号一用。
  // 逐标题贪心会让先处理的标题抢走更近邻行的数字（如 y=210 先抢走 y=203，
  // 而它真正属于 y=200 的行），必须全局比。
  interface Candidate {
    title: TitleRow
    num: NumberFrag
    dy: number
  }
  const candidates: Candidate[] = []
  for (const title of titles) {
    for (const num of numbers) {
      if (num.x <= title.x + minXGap) continue
      const dy = Math.abs(num.y - title.y)
      if (dy > maxDy) continue
      candidates.push({ title, num, dy })
    }
  }
  candidates.sort((a, b) => a.dy - b.dy)
  for (const { title, num } of candidates) {
    if (num.used || pages.has(title.section)) continue
    num.used = true
    pages.set(title.section, num.page)
    paired += 1
  }

  return { pages, paired, droppedLowConf, droppedOutOfRange }
}
