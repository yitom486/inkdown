import type { PDFDocumentProxy } from 'pdfjs-dist'
import { pageHasNativeText } from '@shared/reader/ocr-page-words'
import type { PdfOcrPageCache } from '@shared/types/ocr'

export async function readPdfPageNativeText(
  pdf: PDFDocumentProxy,
  page: number,
): Promise<string> {
  const content = await (await pdf.getPage(page)).getTextContent()
  return content.items.map((item) => ('str' in item ? item.str : '')).join('')
}

export function textFromOcrPageCache(cache: PdfOcrPageCache): string {
  return cache.words.map((word) => word.text).join('')
}

export function pdfPageNeedsOcr(nativeText: string): boolean {
  const charCount = nativeText.replace(/\s/g, '').length
  return !pageHasNativeText(charCount)
}
