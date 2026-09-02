import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { ReaderUnit } from '@/lib/reader/reader-navigation'

export type PdfOutlineSource = 'embedded' | 'page-fallback'

export interface PdfOutlineLoadResult {
  units: ReaderUnit[]
  source: PdfOutlineSource
  /** @deprecated 使用 resolvedItemCount */
  embeddedItemCount: number
  outlineItemCount: number
  resolvedItemCount: number
  unresolvedItemCount: number
}

interface PdfOutlineItem {
  title: string
  dest: string | unknown[] | Record<string, unknown> | null
  items?: PdfOutlineItem[]
}

type PageRef = Parameters<PDFDocumentProxy['getPageIndex']>[0]

async function resolveExplicitDest(
  pdf: PDFDocumentProxy,
  explicitDest: unknown[],
): Promise<number | null> {
  if (!explicitDest.length) return null
  const pageRef = explicitDest[0]
  if (pageRef == null) return null
  const pageIndex = await pdf.getPageIndex(pageRef as PageRef)
  return pageIndex + 1
}

async function resolveDestToPage(
  pdf: PDFDocumentProxy,
  dest: PdfOutlineItem['dest'],
): Promise<number | null> {
  if (!dest) return null

  try {
    if (typeof dest === 'string') {
      const explicitDest = await pdf.getDestination(dest)
      if (!explicitDest || !Array.isArray(explicitDest)) return null
      return resolveExplicitDest(pdf, explicitDest)
    }

    if (Array.isArray(dest)) {
      return resolveExplicitDest(pdf, dest)
    }

    if (typeof dest === 'object') {
      const pageIndex = await pdf.getPageIndex(dest as PageRef)
      return pageIndex + 1
    }

    return null
  } catch {
    return null
  }
}

interface FlattenOutlineResult {
  units: ReaderUnit[]
  outlineItemCount: number
  resolvedItemCount: number
  unresolvedItemCount: number
}

async function flattenPdfOutline(
  pdf: PDFDocumentProxy,
  items: PdfOutlineItem[],
  level = 0,
): Promise<FlattenOutlineResult> {
  const units: ReaderUnit[] = []
  let outlineItemCount = 0
  let resolvedItemCount = 0
  let unresolvedItemCount = 0

  for (const item of items) {
    outlineItemCount += 1
    const page = await resolveDestToPage(pdf, item.dest)
    if (page !== null) {
      resolvedItemCount += 1
      units.push({
        label: item.title.trim() || `第 ${page} 页`,
        href: String(page),
        level,
      })
    } else {
      unresolvedItemCount += 1
    }

    if (item.items?.length) {
      const nested = await flattenPdfOutline(pdf, item.items, level + 1)
      units.push(...nested.units)
      outlineItemCount += nested.outlineItemCount
      resolvedItemCount += nested.resolvedItemCount
      unresolvedItemCount += nested.unresolvedItemCount
    }
  }

  return { units, outlineItemCount, resolvedItemCount, unresolvedItemCount }
}

function buildPageUnits(numPages: number): ReaderUnit[] {
  return Array.from({ length: numPages }, (_, index) => ({
    label: `第 ${index + 1} 页`,
    href: String(index + 1),
    level: 0,
  }))
}

function emptyOutlineStats(): Pick<
  PdfOutlineLoadResult,
  'outlineItemCount' | 'resolvedItemCount' | 'unresolvedItemCount' | 'embeddedItemCount'
> {
  return {
    outlineItemCount: 0,
    resolvedItemCount: 0,
    unresolvedItemCount: 0,
    embeddedItemCount: 0,
  }
}

/** 读取 PDF 书签目录；无 outline 时按页生成占位单元 */
export async function loadPdfOutlineInfo(pdf: PDFDocumentProxy): Promise<PdfOutlineLoadResult> {
  const outline = (await pdf.getOutline()) as PdfOutlineItem[] | null
  if (!outline?.length) {
    return {
      units: buildPageUnits(pdf.numPages),
      source: 'page-fallback',
      ...emptyOutlineStats(),
    }
  }

  const flattened = await flattenPdfOutline(pdf, outline)
  if (flattened.units.length > 0) {
    return {
      units: flattened.units,
      source: 'embedded',
      outlineItemCount: flattened.outlineItemCount,
      resolvedItemCount: flattened.resolvedItemCount,
      unresolvedItemCount: flattened.unresolvedItemCount,
      embeddedItemCount: flattened.resolvedItemCount,
    }
  }

  return {
    units: buildPageUnits(pdf.numPages),
    source: 'page-fallback',
    outlineItemCount: flattened.outlineItemCount,
    resolvedItemCount: 0,
    unresolvedItemCount: flattened.unresolvedItemCount,
    embeddedItemCount: 0,
  }
}

/** @deprecated 使用 loadPdfOutlineInfo */
export async function loadPdfOutlineUnits(pdf: PDFDocumentProxy): Promise<ReaderUnit[]> {
  const result = await loadPdfOutlineInfo(pdf)
  return result.units
}

export function formatPdfOutlineNotice(
  result: PdfOutlineLoadResult,
  isScannedPdf: boolean,
): string | undefined {
  if (result.source === 'embedded' && result.unresolvedItemCount > 0) {
    return `${result.unresolvedItemCount} 条嵌入书签未能解析页码，已从目录中跳过。`
  }

  if (result.source === 'page-fallback' && result.outlineItemCount > 0) {
    return isScannedPdf
      ? '检测到嵌入目录但无法解析页码，可使用上方「识别目录」生成章节目录。'
      : '检测到嵌入目录但无法解析页码，当前按页浏览。'
  }

  return undefined
}
