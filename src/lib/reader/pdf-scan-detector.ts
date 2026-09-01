import type { PDFDocumentProxy } from 'pdfjs-dist'

const SAMPLE_PAGES = 3
const MIN_CHARS_PER_PAGE = 8

async function pageTextCharCount(pdf: PDFDocumentProxy, pageNumber: number): Promise<number> {
  const page = await pdf.getPage(pageNumber)
  const content = await page.getTextContent()
  return content.items.reduce((sum, item) => {
    const str = 'str' in item && typeof item.str === 'string' ? item.str : ''
    return sum + str.replace(/\s/g, '').length
  }, 0)
}

export interface PdfDocumentProfile {
  /** 抽样页均无有效文字层 */
  isScanned: boolean
  sampledPages: number
  sampledCharCount: number
}

/** 根据前几页文字层判断是否为扫描版 PDF */
export async function detectPdfDocumentProfile(
  pdf: PDFDocumentProxy,
): Promise<PdfDocumentProfile> {
  const sampleCount = Math.min(SAMPLE_PAGES, pdf.numPages)
  let sampledCharCount = 0

  for (let page = 1; page <= sampleCount; page += 1) {
    sampledCharCount += await pageTextCharCount(pdf, page)
  }

  const avgChars = sampleCount > 0 ? sampledCharCount / sampleCount : 0
  return {
    isScanned: avgChars < MIN_CHARS_PER_PAGE,
    sampledPages: sampleCount,
    sampledCharCount,
  }
}
