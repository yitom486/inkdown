import type { BookBlockType } from '../types/book-db'
import { normalizeWatermarkText } from './ocr-watermark'

/**
 * 正文水印补丁规划器（纯函数，只产出提案，不碰库）。
 *
 * 安全边界（Phase 2.1 冻结）：
 * - 绝不复用 cleanOcrWatermarks / expandWatermarkFragments：自动碎片扩展会把单字
 *   “王”收进水印集合并允许 token 修剪，本模块禁止这种行为。
 * - 两类显式规则，无“母体包含子串”“家族模糊匹配”“单字/双字自动扩展”：
 *   1. wholeBlockOnly：整个 block 归一化后完全相等才删除（单字“王”只删独立块，
 *      “王 DMA 方式”不动）。
 *   2. trimEligible：归一化长度 ≥3 的显式 token，只修空白分隔的首尾。
 * - type=table 永不产出补丁；输出只含 { id, action, before, after?, reason, pageNumber }，
 *   不携带、不修改 id/坐标/章节归属/type/confidence。
 */

export interface BodyBlockInput {
  id: number
  type: BookBlockType
  content: string
  pageNumber: number
}

export type BodyWatermarkAction = 'delete' | 'update'

export interface BodyWatermarkPatch {
  id: number
  action: BodyWatermarkAction
  before: string
  /** update 才有；delete 无 after */
  after?: string
  reason: string
  pageNumber: number
}

/**
 * 整块删除表（归一化键，显式列出；来源：真书 8889 块只读审计，
 * 独立成块且跨页出现的水印 OCR 碎片；拉丁单字母/疑似合法词一律排除）。
 */
export const WHOLE_BLOCK_ONLY_WATERMARKS: readonly string[] = [
  '王',
  '育',
  '王道',
  '教育',
  '机教',
  '道计',
  '算机',
  '文育',
  '王道计',
  '机教育',
  '早机教育',
  '算机教育',
  '计算机教育',
  '王道计算',
  '道计算机教育',
  '算机教',
  '王道计算机教育',
  // 下列为封面/广告页实录的无分隔叠写（逐字出现过才收录，不做模式扩展）：
  '王道计算机王道计算机教育',
  '王道计算机教育王道计',
]

/**
 * 首尾修剪表（归一化 token，显式列出；长度全部 ≥3，单字/双字不得入内，
 * 所以“王”“育”“王道”“教育”只删整块、不修剪文本）。
 */
export const TRIM_ELIGIBLE_WATERMARKS: readonly string[] = [
  '王道计',
  '机教育',
  '早机教育',
  '算机教育',
  '计算机教育',
  '王道计算',
  '道计算机教育',
  '算机教',
  '王道计算机教育',
]

const wholeBlockSet = new Set<string>(WHOLE_BLOCK_ONLY_WATERMARKS)
const trimSet = new Set<string>(TRIM_ELIGIBLE_WATERMARKS)

interface TokenSpan {
  text: string
  start: number
  end: number
}

function splitTokenSpans(content: string): TokenSpan[] {
  const spans: TokenSpan[] = []
  const re = /\S+/g
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    spans.push({ text: match[0], start: match.index, end: match.index + match[0].length })
  }
  return spans
}

function planOne(block: BodyBlockInput): BodyWatermarkPatch | null {
  if (block.type === 'table') return null
  if (block.content.trim().length === 0) return null
  const norm = normalizeWatermarkText(block.content)
  if (norm.length === 0) return null
  if (wholeBlockSet.has(norm)) {
    return {
      id: block.id,
      action: 'delete',
      before: block.content,
      reason: `whole-block:${norm}`,
      pageNumber: block.pageNumber,
    }
  }
  const spans = splitTokenSpans(block.content)
  if (spans.length === 0) return null
  let start = 0
  let end = spans.length
  const stripped: string[] = []
  while (start < end) {
    const key = normalizeWatermarkText(spans[start]?.text ?? '')
    if (!trimSet.has(key)) break
    stripped.push(key)
    start += 1
  }
  while (end > start) {
    const key = normalizeWatermarkText(spans[end - 1]?.text ?? '')
    if (!trimSet.has(key)) break
    stripped.push(key)
    end -= 1
  }
  if (stripped.length === 0) return null
  if (start >= end) {
    // 整块全由水印 token 组成（如“王道计 王道计 机教育 机教育”）：删块，不留空串
    return {
      id: block.id,
      action: 'delete',
      before: block.content,
      reason: `trim-to-empty:${[...new Set(stripped)].join('+')}`,
      pageNumber: block.pageNumber,
    }
  }
  const first = spans[start]
  const last = spans[end - 1]
  if (!first || !last) return null
  const after = block.content.slice(first.start, last.end)
  if (after === block.content || after.trim().length === 0) return null
  // 修剪残留本身仍是整块水印（如“机教育 王道”→“王道”）：直接删块，不留碎片
  if (wholeBlockSet.has(normalizeWatermarkText(after))) {
    return {
      id: block.id,
      action: 'delete',
      before: block.content,
      reason: `trim-then-whole:${[...new Set(stripped)].join('+')}>${normalizeWatermarkText(after)}`,
      pageNumber: block.pageNumber,
    }
  }
  return {
    id: block.id,
    action: 'update',
    before: block.content,
    after,
    reason: `trim-edge:${[...new Set(stripped)].join('+')}`,
    pageNumber: block.pageNumber,
  }
}

/** 既有 blocks → 补丁提案（输入顺序即输出顺序，不重排 block_index） */
export function planBodyWatermarkPatches(blocks: readonly BodyBlockInput[]): BodyWatermarkPatch[] {
  const patches: BodyWatermarkPatch[] = []
  for (const block of blocks) {
    const patch = planOne(block)
    if (patch) patches.push(patch)
  }
  return patches
}
