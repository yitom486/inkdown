import {
  PDF_OCR_TOC_CACHE_VERSION,
  type PdfOcrTocCache,
  type ReaderTocUnit,
} from '@shared/types/ocr'
import { ocrTocToReaderUnits } from './ocr-toc-extractor'

/**
 * OCR 目录缓存评估（纯函数）：usable / suspect / invalid / legacy。
 *
 * - invalid 只判客观结构错误：空、无非法条目、页码或目录页范围越过真实
 *   页数、entries/units 无法恢复的不一致。绝不以条数、缺章、编号跳跃判 invalid。
 * - suspect 只表达“不足以确认完整”（自动识别未经人工确认），不伪装成“确定残缺”。
 * - legacy：结构可读但缺少来源记录的旧版缓存（不自动删除，允许查看/重识/保存确认）。
 * - user-reviewed（origin=reviewed）短目录不受启发式完整性规则影响。
 * - entries 有效但 units 可重建时优先安全修复（repairedUnits），不判 invalid。
 */
export type OcrTocCacheStatus = 'usable' | 'suspect' | 'invalid' | 'legacy'

export interface OcrTocCacheAssessment {
  status: OcrTocCacheStatus
  /** 机器可读原因（稳定措辞，UI 取首条展示短原因） */
  reasons: string[]
  /** entries 有效但 units 缺失/失配时按条目重建的侧栏（调用方用它恢复） */
  repairedUnits?: ReaderTocUnit[]
}

function isValidPageCount(pageCount: number): boolean {
  return Number.isInteger(pageCount) && pageCount >= 1
}

function unitsMatch(
  actual: readonly ReaderTocUnit[],
  expected: readonly ReaderTocUnit[],
): boolean {
  if (actual.length !== expected.length) return false
  return actual.every(
    (unit, index) =>
      unit.label === expected[index]?.label &&
      unit.href === expected[index]?.href &&
      unit.level === expected[index]?.level,
  )
}

export function assessPdfOcrTocCache(
  cache: PdfOcrTocCache | null | undefined,
  options: { pageCount: number },
): OcrTocCacheAssessment {
  const { pageCount } = options
  if (!cache || typeof cache !== 'object') {
    return { status: 'invalid', reasons: ['缓存为空或无法解析'] }
  }
  if (!Array.isArray(cache.entries) || cache.entries.length === 0) {
    return { status: 'invalid', reasons: ['空目录：无有效条目'] }
  }
  if (!Number.isFinite(cache.pageOffset)) {
    return { status: 'invalid', reasons: ['页码偏移非法'] }
  }
  const [rangeFrom, rangeTo] = cache.tocPageRange ?? []
  if (
    !Number.isInteger(rangeFrom) ||
    !Number.isInteger(rangeTo) ||
    (rangeFrom as number) < 1 ||
    (rangeTo as number) < (rangeFrom as number) ||
    (isValidPageCount(pageCount) && (rangeTo as number) > pageCount)
  ) {
    return { status: 'invalid', reasons: ['目录页范围非法或越过全书页数'] }
  }
  for (const entry of cache.entries) {
    const titleOk = typeof entry.title === 'string' && entry.title.trim().length > 0
    const pageOk = Number.isInteger(entry.printedPage) && (entry.printedPage as number) >= 1
    const levelOk = Number.isInteger(entry.level) && (entry.level as number) >= 0
    if (!titleOk || !pageOk || !levelOk) {
      return { status: 'invalid', reasons: [`非法条目：「${String(entry?.title ?? '')}」`] }
    }
    if (isValidPageCount(pageCount) && (entry.printedPage as number) + cache.pageOffset > pageCount) {
      return {
        status: 'invalid',
        reasons: [`页码越界：「${entry.title}」印刷页 ${entry.printedPage}+偏移 ${cache.pageOffset} 超出全书 ${pageCount} 页`],
      }
    }
  }

  // entries 有效 → units 缺失/失配一律按条目重建，不判 invalid
  const expectedUnits = ocrTocToReaderUnits(
    cache.entries.map((entry) => ({
      title: entry.title,
      printedPage: entry.printedPage,
      level: entry.level,
      raw: entry.title,
    })),
    cache.pageOffset,
  )
  let repairedUnits: ReaderTocUnit[] | undefined
  if (!Array.isArray(cache.units) || !unitsMatch(cache.units, expectedUnits)) {
    repairedUnits = expectedUnits
  }

  // 来源判定：无来源记录（旧版）→ legacy；自动识别 → suspect；用户确认 → usable。
  // 条数、缺章、编号跳跃永不参与判定（短目录/跳号/人工修订皆可合法）。
  const hasProvenance = cache.origin !== undefined || cache.stats !== undefined
  const versionMismatch =
    cache.extractorVersion !== undefined && cache.extractorVersion !== PDF_OCR_TOC_CACHE_VERSION
  if (!hasProvenance || versionMismatch) {
    const assessment: OcrTocCacheAssessment = {
      status: 'legacy',
      reasons: ['旧版缓存缺少来源记录，建议打开校正目录核对后保存确认'],
    }
    if (repairedUnits) assessment.repairedUnits = repairedUnits
    return assessment
  }
  if (cache.origin === 'reviewed') {
    const assessment: OcrTocCacheAssessment = { status: 'usable', reasons: [] }
    if (repairedUnits) assessment.repairedUnits = repairedUnits
    return assessment
  }
  const accepted = cache.stats?.acceptedEntries ?? cache.entries.length
  const filtered =
    (cache.stats?.droppedPool ?? 0) + (cache.stats?.droppedLines ?? 0)
  const assessment: OcrTocCacheAssessment = {
    status: 'suspect',
    reasons: [
      `自动识别结果未经人工确认（共 ${accepted} 条${filtered > 0 ? `，过滤 ${filtered} 处` : ''}）`,
    ],
  }
  if (repairedUnits) assessment.repairedUnits = repairedUnits
  return assessment
}
