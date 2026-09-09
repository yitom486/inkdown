import {
  isBareChapterTitle,
  isDigitSoupTitle,
  isNoiseLine,
  isWatermarkTocEntry,
  normalizeOcrChinese,
  parsePagelessHeading,
  TOC_LINE,
} from './ocr-toc-extractor'

/**
 * 目录 OCR 文本重组：先拼后提。
 *
 * 同一页目录在 OCR 里散成三种行（标题裸奔、竖线包行、数字汤），
 * 本模块只做形状级重组，不做语义判定：
 * - 竖线包行 `|标题|页码|` → 拆成 `标题 页码`（号无效则留标题走无号流程）
 * - 数字汤行 → 数字进池，按阅读顺序配给之前攒的光杆标题
 * - 光杆标题 → 配对成功出 `标题 页码`，配不上原样吐出（下游回填兜底）
 * - 认不出的行（正文/广告/水印）→ 丢弃计数
 *
 * 关键约束（防编造）：
 * - 数字进池必须过范围门（印刷页 + 偏移 = 真实页 ∈ [1, 总页数]），
 *   否则水印数字（如 87929797）会污染对号；无范围参数时整段原样透传。
 * - 遇到自带页码的行（竖线/原文直连）先把攒的标题按光杆吐出，
 *   数字只配给它之前的标题，不跨区。
 * - 章行不进配对队列（真目录章必带页码，见 isBareChapterTitle）。
 */

export interface DirectoryReassembleOptions {
  /** 真实总页数（与 pageOffset 联动做范围门） */
  pageCount?: number
  /** 印刷页 + 偏移 = 真实页 */
  pageOffset?: number
  /** 调试追踪（默认关闭）：每行判定与配对事件 */
  onTrace?: (event: string) => void
}

export interface DirectoryReassembleStats {
  /** 拆开的竖线行 */
  pipeRows: number
  /** 配对成功的标题数 */
  paired: number
  /** 进池的数字个数 */
  poolNumbers: number
  /** 被丢弃的池数字（超范围等） */
  droppedPool: number
  /** 原样吐出的光杆标题数 */
  bareEmitted: number
  /** 丢弃的行数（噪音/水印/正文/孤儿数字） */
  droppedLines: number
}

export interface ReassembledDirectory {
  text: string
  stats: DirectoryReassembleStats
}

const PIPE_ROW = /^\|(.+)\|$/
const PIPE_INNER_SPLIT = /^(.*)\|([^|]*)$/
const DIGIT_RUN = /\d+/g
const TRAILING_SEPARATORS = /[·…．。\-—–_\s]+$/

function stripTrailingSeparators(title: string): string {
  return title.replace(TRAILING_SEPARATORS, '')
}

/** 与启发式 TOC_LINE 分支同口径的标题准入（水印/数字汤/纯数字/无中文全挡） */
function isKeepableTitle(title: string): boolean {
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

function inRange(page: number, options?: DirectoryReassembleOptions): boolean {
  if (options?.pageCount == null || options?.pageOffset == null) return true
  if (!Number.isFinite(options.pageCount) || !Number.isFinite(options.pageOffset)) return true
  const real = page + Math.round(options.pageOffset)
  return real >= 1 && real <= options.pageCount
}

/** 标题行首的章节号（"3.1.2主存储器"→"3.1.2"）；无则 null */
export function sectionOfHeading(title: string): string | null {
  const match = /^(\d+(?:\.\d+)*)/.exec(title.trim())
  return match ? (match[1] ?? null) : null
}

/**
 * 章节号版本比较（"2.1.3" < "2.2"，"3.1.2" == "3.1.2"）。
 * 任一不可解析返回 null（调用方跳过该锚点，不断整批）。
 */
export function compareSectionStrings(a: string, b: string): -1 | 0 | 1 | null {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  if (pa.some((n) => !Number.isInteger(n)) || pb.some((n) => !Number.isInteger(n))) return null
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x < y) return -1
    if (x > y) return 1
  }
  return 0
}

interface PoolAnchor {
  section: string
  page: number
}

export function reassembleDirectoryText(
  rawText: string,
  options?: DirectoryReassembleOptions,
): ReassembledDirectory {
  const stats: DirectoryReassembleStats = {
    pipeRows: 0,
    paired: 0,
    poolNumbers: 0,
    droppedPool: 0,
    bareEmitted: 0,
    droppedLines: 0,
  }
  const rangeGated = options?.pageCount != null && options?.pageOffset != null
  // 无范围参数：整段原样透传，零行为变化（旧调用方与旧单测走这条）。
  // 有范围参数才做形状重组（竖线拆分/数字汤配对/范围门）。
  if (!rangeGated) {
    return { text: rawText, stats }
  }
  const trace = options?.onTrace
  const out: string[] = []
  // 待配对的光杆标题（到达顺序）；遇到自带页码的行即全部吐出，避免跨区错配
  let pending: string[] = []
  const flushPending = (): void => {
    for (const title of pending) {
      out.push(title)
      stats.bareEmitted += 1
    }
    pending = []
  }
  // 数字池只在同一次相遇中有效：标题→汤→配对→清零，不跨区携带
  // 配对门（-2≤pending-pool≤2 的绝对差 ≤2）：两边数量须基本一致，
  // 否则必有一方属于别的区域（如 1 标题对 7 个数、10 标题对 2 个数），
  // 硬配一定错位，整批放弃（标题转光杆，数字计数丢弃）。
  const pairWithPool = (numbers: number[]): void => {
    if (
      pending.length === 0 ||
      numbers.length === 0 ||
      Math.abs(pending.length - numbers.length) > 2
    ) {
      flushPending()
      stats.droppedPool += numbers.length
      return
    }
    const count = Math.min(pending.length, numbers.length)
    for (let i = 0; i < count; i += 1) {
      out.push(`${pending[i]} ${numbers[i]}`)
      stats.paired += 1
      trace?.(`pair ${pending[i]} <- ${numbers[i]}`)
    }
    for (let i = count; i < pending.length; i += 1) {
      out.push(pending[i] as string)
      stats.bareEmitted += 1
    }
    stats.droppedPool += numbers.length - count
    pending = []
  }

  // “*” 是删纲标记前缀（*1.1…），OCR 常把两节黏在一行
  // （6.1.1… *6.1.2…、*7.1.1… *7.1.2…）：按 * 拆成多行逐个处理，
  // 不拆则整行因不合形状被丢弃，7.1 系整段丢失。
  const splitLines: string[] = []
  for (const rawLine of rawText.split(/\r?\n/)) {
    if (!rawLine.includes('*')) {
      splitLines.push(rawLine)
      continue
    }
    for (const part of rawLine.split('*')) {
      if (part.trim()) splitLines.push(part)
    }
  }

  for (const rawLine of splitLines) {
    const line = rawLine.trim()
    if (!line) continue
    const compact = normalizeOcrChinese(line)

    // 0. 纯数字行（无 CJK、有数字）：直接进池，不受短行噪音门限牵连。
    // "8 9" 去空格后只剩 2 字会被噪音规则误杀，但它只可能是散号。
    // 整行仅 1 个数字字符（如孤立 "8"）太暧昧，直接丢弃。
    // 竖线包行不在此列（结构优先，后面专门处理）。
    if (!/[\u4e00-\u9fff]/.test(compact) && /\d/.test(compact) && !line.includes('|')) {
      if (compact.replace(/\D/g, '').length <= 1 || !rangeGated) {
        stats.droppedLines += 1
        continue
      }
      const numbers: number[] = []
      for (const run of line.match(DIGIT_RUN) ?? []) {
        const n = Number.parseInt(run, 10)
        if (Number.isInteger(n) && n >= 1 && inRange(n, options)) numbers.push(n)
        else stats.droppedPool += 1
      }
      if (numbers.length === 0) {
        stats.droppedLines += 1
        continue
      }
    stats.poolNumbers += numbers.length
    trace?.(`soup numbers=[${numbers.join(',')}] pending=${pending.length}`)
    pairWithPool(numbers)
    continue
  }

    if (isNoiseLine(line)) {
      stats.droppedLines += 1
      continue
    }
    if (isWatermarkTocEntry(compact)) {
      stats.droppedLines += 1
      continue
    }

    // 1. 竖线包行：|标题|页码| → 标题 页码；号无效/无号则标题走光杆流程
    const pipe = PIPE_ROW.exec(line)
    if (pipe) {
      flushPending()
      stats.pipeRows += 1
      const inner = (pipe[1] ?? '').trim()
      // 内层按最后一个 | 切分：左=标题候选，右=页码候选；无内层竖线视为普通行透传
      const innerSplit = PIPE_INNER_SPLIT.exec(inner)
      if (!innerSplit) {
        out.push(line)
        continue
      }
      const titlePart = (innerSplit[1] ?? '').replace(/\|/g, ' ').trim()
      // 页码须是干净数字（仅允许点线分隔符环绕）："?2" 中的 ? 是 OCR 缺字证据，
      // 说明高位数字丢了，此时信任 2 必错，转光杆流程；"-27" 的前导 - 是点线残留，可信。
      const numMatch = /^[\s·…．。\-—–_]*(\d+)\s*$/.exec((innerSplit[2] ?? '').trim())
      const numText = numMatch ? (numMatch[1] ?? '') : ''
      const cleanTitle = stripTrailingSeparators(normalizeOcrChinese(titlePart))
      if (!isKeepableTitle(cleanTitle) || isNoiseLine(cleanTitle)) {
        stats.droppedLines += 1
        continue
      }
      const num = numText ? Number.parseInt(numText, 10) : NaN
      if (cleanTitle && Number.isInteger(num) && num >= 1 && inRange(num, options)) {
        out.push(`${cleanTitle} ${num}`)
        trace?.(`pipe ${cleanTitle} <- ${num}`)
        continue
      }
      // 号无效、无号或标题不可留：标题进光杆队列（章行不进，下游专规则处理）；
      // 实在无处可去才计数丢弃
      if (cleanTitle && !isBareChapterTitle(cleanTitle)) {
        const pageless = parsePagelessHeading(cleanTitle)
        if (pageless) {
          pending.push(pageless)
          continue
        }
      }
      stats.droppedLines += 1
      continue
    }

    // 3. 自带页码的行：原样透传（下游照常解析），先吐出攒的标题
    if (TOC_LINE.test(compact)) {
      flushPending()
      out.push(line)
      continue
    }

    // 4. 光杆标题：攒起来等数字汤（章行不进队列，下游有专规则）
    const pageless = parsePagelessHeading(compact)
    if (pageless) {
      pending.push(pageless)
      continue
    }

    // 4.5 无号章行：原样透传。启发式 downstream 照旧丢弃（专规则），
    // 但 AI 路径要看见章标题才能补全层级——透传是给模型看的。
    if (isBareChapterTitle(compact)) {
      out.push(line)
      continue
    }

    // 5. 其余（正文句/残片/黏连双标题等）：一律丢弃计数。
    // 注意：含 CJK+数字但三振出局的行（如两标题黏连）绝不能进池——
    // 里面的章节号（5/7/3…）会被误当页码，这是最隐蔽的污染源。宁可漏，不许错配。
    stats.droppedLines += 1
  }
  flushPending()
  return { text: out.join('\n'), stats }
}
