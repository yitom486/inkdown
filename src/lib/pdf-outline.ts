import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { ReaderUnit } from '@/lib/reader-navigation'

interface PdfOutlineItem {
  title: string
  dest: string | unknown[] | null
  items?: PdfOutlineItem[]
}

async function resolveDestToPage(
  pdf: PDFDocumentProxy,
  dest: string | unknown[] | null,
): Promise<number | null> {
  if (!dest) return null

  try {
    const explicitDest = typeof dest === 'string' ? await pdf.getDestination(dest) : dest
    if (!explicitDest || !Array.isArray(explicitDest)) return null
    const pageIndex = await pdf.getPageIndex(explicitDest[0] as Parameters<PDFDocumentProxy['getPageIndex']>[0])
    return pageIndex + 1
  } catch {
    return null
  }
}

async function flattenPdfOutline(
  pdf: PDFDocumentProxy,
  items: PdfOutlineItem[],
  level = 0,
): Promise<ReaderUnit[]> {
  const units: ReaderUnit[] = []

  for (const item of items) {
    const page = await resolveDestToPage(pdf, item.dest)
    if (page !== null) {
      units.push({
        label: item.title.trim() || `第 ${page} 页`,
        href: String(page),
        level,
      })
    }

    if (item.items?.length) {
      units.push(...(await flattenPdfOutline(pdf, item.items, level + 1)))
    }
  }

  return units
}

function buildPageUnits(numPages: number): ReaderUnit[] {
  return Array.from({ length: numPages }, (_, index) => ({
    label: `第 ${index + 1} 页`,
    href: String(index + 1),
    level: 0,
  }))
}

/** 读取 PDF 书签目录；无 outline 时按页生成占位单元 */
export async function loadPdfOutlineUnits(pdf: PDFDocumentProxy): Promise<ReaderUnit[]> {
  const outline = (await pdf.getOutline()) as PdfOutlineItem[] | null
  if (!outline?.length) {
    return buildPageUnits(pdf.numPages)
  }

  const units = await flattenPdfOutline(pdf, outline)
  return units.length > 0 ? units : buildPageUnits(pdf.numPages)
}
