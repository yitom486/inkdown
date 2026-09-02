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
