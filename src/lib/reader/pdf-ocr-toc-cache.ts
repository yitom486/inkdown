import { ocrTocToReaderUnits } from '@shared/reader/ocr-toc-extractor'
import type { OcrTocEntry, PdfOcrTocCache, ReaderTocUnit } from '@shared/types/ocr'

export function buildPdfOcrTocCache(params: {
  fileFingerprint: string
  tocPageRange: [number, number]
  pageOffset: number
  entries: OcrTocEntry[]
}): PdfOcrTocCache {
  const entries = params.entries
    .map((entry) => ({
      title: entry.title.trim(),
      printedPage: entry.printedPage,
      level: entry.level,
      // 证据来源随条目持久化（pipe/geo/ai/manual，合并裁决用）；用户修订不带旧摘要
      source: entry.source,
    }))
    .filter((entry) => entry.title.length > 0 && entry.printedPage > 0)

  return {
    fileFingerprint: params.fileFingerprint,
    tocPageRange: params.tocPageRange,
    pageOffset: params.pageOffset,
    entries,
    units: ocrTocToReaderUnits(
      entries.map((entry) => ({ ...entry, raw: entry.title })),
      params.pageOffset,
    ),
    createdAt: new Date().toISOString(),
    // 用户点保存（含 AI 核对后保存）即视为已确认：短目录也不被完整性规则隐藏
    origin: 'reviewed',
  }
}

export function readerUnitsToOcrEntries(
  units: ReaderTocUnit[],
  pageOffset: number,
): OcrTocEntry[] {
  return units.map((unit) => ({
    title: unit.label,
    printedPage: Math.max(1, Number.parseInt(unit.href, 10) - pageOffset),
    level: unit.level,
  }))
}
