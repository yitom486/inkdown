import { TOC_LINE, isDigitSoupTitle, isWatermarkTocEntry, normalizeOcrChinese } from './ocr-toc-extractor'

/**
 * 目录页探测评分（纯函数）：在文档前部窗口里找目录所在的连续页段。
 *
 * 背景（王道书前 40 页 150dpi 实测）：目录页（8–12）与正文表格页都会
 * 产生大量竖线行/数字行，单靠“表格行多”会把正文表格页（26/38/40）
 * 误判为目录。真正拉开差距的是三组特征的组合：
 * - 点引导符行（……/···）：目录页有，正文表格页为 0；
 * - 章节号行密度（sectionRatio）：目录页 0.40+，正文表格页 ≤0.28；
 * - “目录”标题：目录段内必有（至少一页）。
 * 因此评分只负责“页像不像目录”，段选择再要求标题佐证，单页成段
 * 必须自带标题——正文表格页再强也过不了这一关。
 */

/** 探测窗口上限（页）：只看文档前部，目录在后的书仍需手填（见 README 限制） */
export const TOC_DETECT_MAX_PAGES = 40
/** 单页达标线（王道实测：目录页 64+，正文表格页 22–54 但无标题佐证） */
export const TOC_DETECT_PAGE_THRESHOLD = 25
/** 成段最低总分（防单页弱标题页成段） */
export const TOC_DETECT_MIN_SEGMENT_TOTAL = 40
/** 次优段达到最优段的该比例即判 ambiguous（宁可让人选，不替人猜） */
export const TOC_DETECT_AMBIGUOUS_RATIO = 0.7
/** 段内允许的连续低分间隙页数（跨页目录中间夹一页弱页） */
export const TOC_DETECT_MAX_GAP = 1
/** 无标题多页段的兜底门槛（标题 OCR 漏检时）：够长、够密、总分够高 */
export const TOC_DETECT_FALLBACK_MIN_LENGTH = 3
export const TOC_DETECT_FALLBACK_MIN_TOTAL = 120
export const TOC_DETECT_FALLBACK_MIN_DENSE_LINES = 10

export interface TocPageFeatures {
  page: number
  hasHeading: boolean
  pipeRows: number
  tocLines: number
  dotLines: number
  sectionLines: number
  soupLines: number
  questionLines: number
  sectionRatio: number
  score: number
  /** 强证据页：自带标题，或表格/成对行密到不可能是正文 */
  strong: boolean
}

const DOT_RUN = /[…]{2,}|[·.]{4,}|[-—–]{4,}/
const SECTION_LINE = /^(?:\d+\.)+\d*[\u4e00-\u9fff]/
// 题号行（习题页）：纯数字编号后紧跟标点且后不跟数字（`1．题干`是题，
// `2.3 浮点数`是章节——点后跟数字的排除，否则每条章节行都被误罚）
const QUESTION_LINE = /^(?:\d+\s*[.、．)](?!\d)|[一二三四五六七八九十]+\s*[、．])/
const PIPE_LINE = /^\|.*\|$/

function countTocLines(compact: string): boolean {
  const m = TOC_LINE.exec(compact)
  if (!m) return false
  const title = (m[1] ?? '').trim()
  if (title.length < 2) return false
  if (!/[\u4e00-\u9fff]/.test(title) && !/^第\d+章/.test(title) && !/^\d+\.\d+/.test(title)) {
    return false
  }
  if (/^\d[\d.\-]*$/.test(title)) return false
  if (/^7-121/.test(title)) return false
  if (isWatermarkTocEntry(title)) return false
  if (isDigitSoupTitle(title)) return false
  return true
}

export function scoreTocPageMarkdown(page: number, markdown: string): TocPageFeatures {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const hasHeading = /目录|CONTENTS/i.test(markdown.replace(/\s+/g, ''))
  let pipeRows = 0
  let tocLines = 0
  let dotLines = 0
  let sectionLines = 0
  let soupLines = 0
  let questionLines = 0
  for (const line of lines) {
    if (PIPE_LINE.test(line)) pipeRows += 1
    if (countTocLines(normalizeOcrChinese(line))) tocLines += 1
    if (DOT_RUN.test(line)) dotLines += 1
    const compact = normalizeOcrChinese(line)
    if (SECTION_LINE.test(compact)) sectionLines += 1
    if (
      !/[\u4e00-\u9fff]/.test(compact) &&
      /\d/.test(compact) &&
      compact.replace(/\D/g, '').length > 1
    ) {
      soupLines += 1
    }
    if (QUESTION_LINE.test(line)) questionLines += 1
  }
  const sectionRatio = lines.length > 0 ? sectionLines / lines.length : 0
  // 权重按王道前 40 页实测拉开：点线行与标题权重最高（正文表格页这两项为 0），
  // 表格行权重压低（正文表格页也有）；题号行小额扣分（习题页形似目录）。
  const score =
    25 * (hasHeading ? 1 : 0) +
    4 * Math.min(pipeRows, 8) +
    3 * Math.min(tocLines, 20) +
    4 * Math.min(dotLines, 12) +
    Math.min(sectionLines, 25) +
    2 * Math.min(soupLines, 6) -
    2 * Math.min(questionLines, 8) +
    (sectionRatio >= 0.35 && sectionLines >= 8 ? 12 : 0)
  const strong =
    hasHeading || pipeRows >= 3 || tocLines >= 8 || score >= TOC_DETECT_MIN_SEGMENT_TOTAL + 10
  return {
    page,
    hasHeading,
    pipeRows,
    tocLines,
    dotLines,
    sectionLines,
    soupLines,
    questionLines,
    sectionRatio,
    score,
    strong,
  }
}

export interface TocPageCandidate {
  fromPage: number
  toPage: number
  score: number
}

export type TocDetectOutcome = 'found' | 'ambiguous' | 'not-found'

export interface TocDetectSelection {
  outcome: TocDetectOutcome
  fromPage?: number
  toPage?: number
  /** 候选段（按分排序，最多 3 段；ambiguous 时给用户看差异） */
  candidates: TocPageCandidate[]
}

/**
 * 从逐页评分选目录段：达标页连段（允许 1 页低分间隙，计入范围），
 * 有标题佐证的段才接受；单页段必须自带标题。多个接受段分数接近判 ambiguous。
 */
export function selectTocPageRange(scores: readonly TocPageFeatures[]): TocDetectSelection {
  interface Run {
    fromPage: number
    toPage: number
    total: number
    pages: TocPageFeatures[]
  }
  // 两遍式连段：间隙页只有在后方还有达标页时才计入范围，
  // 结尾悬空的间隙直接丢弃（否则 [4 强][5 正文] 会报成 [4,5]）。
  const qualifiedAt = (index: number): boolean =>
    index >= 0 &&
    index < scores.length &&
    (scores[index]?.score ?? 0) >= TOC_DETECT_PAGE_THRESHOLD
  // 按页号链连段（输入未必连续：缺页输入里数组相邻≠页相邻，跨洞不许连）。
  // 间隙页只有“页号相连且后方紧跟达标页”才计入范围；结尾悬空间隙丢弃。
  const isQualified = (index: number): boolean =>
    index >= 0 &&
    index < scores.length &&
    (scores[index]?.score ?? 0) >= TOC_DETECT_PAGE_THRESHOLD
  const runs: Run[] = []
  let index = 0
  while (index < scores.length) {
    if (!isQualified(index)) {
      index += 1
      continue
    }
    const first = scores[index] as TocPageFeatures
    const run: Run = { fromPage: first.page, toPage: first.page, total: first.score, pages: [first] }
    index += 1
    let gaps = 0
    while (index < scores.length) {
      const current = scores[index] as TocPageFeatures
      if (isQualified(index) && current.page === run.toPage + 1) {
        run.toPage = current.page
        run.total += current.score
        run.pages.push(current)
        gaps = 0
        index += 1
        continue
      }
      const next = scores[index + 1] as TocPageFeatures | undefined
      if (
        gaps < TOC_DETECT_MAX_GAP &&
        !isQualified(index) &&
        current.page === run.toPage + 1 &&
        next !== undefined &&
        isQualified(index + 1) &&
        next.page === current.page + 1
      ) {
        gaps += 1
        run.toPage = current.page
        index += 1
        continue
      }
      break
    }
    runs.push(run)
  }

  const accepted: TocPageCandidate[] = []
  for (const run of runs) {
    const length = run.toPage - run.fromPage + 1
    const hasHeading = run.pages.some((item) => item.hasHeading)
    if (hasHeading) {
      // 单页段必须自带标题（正文表格页再强也止步于此）
      if (length === 1 && !run.pages[0]?.hasHeading) continue
      if (run.total >= TOC_DETECT_MIN_SEGMENT_TOTAL) {
        accepted.push({ fromPage: run.fromPage, toPage: run.toPage, score: run.total })
      }
      continue
    }
    // 无标题兜底：够长、够密、总分够高（标题 OCR 漏检的目录段）
    if (length < TOC_DETECT_FALLBACK_MIN_LENGTH || run.total < TOC_DETECT_FALLBACK_MIN_TOTAL) {
      continue
    }
    const dense = run.pages.reduce((sum, item) => sum + item.tocLines + item.dotLines, 0)
    if (dense < TOC_DETECT_FALLBACK_MIN_DENSE_LINES) continue
    accepted.push({ fromPage: run.fromPage, toPage: run.toPage, score: run.total })
  }

  accepted.sort((a, b) => b.score - a.score)
  const candidates = accepted.slice(0, 3)
  if (accepted.length === 0) return { outcome: 'not-found', candidates }
  const [best, second] = accepted as [TocPageCandidate, (TocPageCandidate | undefined)?]
  if (best && second && second.score >= best.score * TOC_DETECT_AMBIGUOUS_RATIO) {
    return { outcome: 'ambiguous', candidates }
  }
  return { outcome: 'found', fromPage: best.fromPage, toPage: best.toPage, candidates }
}

/**
 * 探测窗口：文档前部固定窗口（成本上限，不扫整本）。
 * pageCount 非法返回空数组（调用方报参数错误）。
 */
export function resolveDetectWindow(pageCount: number): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) return []
  const end = Math.min(TOC_DETECT_MAX_PAGES, pageCount)
  const pages: number[] = []
  for (let page = 1; page <= end; page += 1) pages.push(page)
  return pages
}

export type DetectApplyToast = 'suggest' | 'kept'

/**
 * UI 落子（纯函数）：found 才填范围；ambiguous/not-found 保留用户当前范围。
 * 只返回范围与提示种类，不调用正式识别、不写任何缓存。
 */
export function resolveDetectApply(
  current: { fromPage: number; toPage: number },
  selection: TocDetectSelection,
): { fromPage: number; toPage: number; changed: boolean; toast: DetectApplyToast } {
  if (
    selection.outcome === 'found' &&
    selection.fromPage !== undefined &&
    selection.toPage !== undefined
  ) {
    return {
      fromPage: selection.fromPage,
      toPage: selection.toPage,
      changed: selection.fromPage !== current.fromPage || selection.toPage !== current.toPage,
      toast: 'suggest',
    }
  }
  return { fromPage: current.fromPage, toPage: current.toPage, changed: false, toast: 'kept' }
}
