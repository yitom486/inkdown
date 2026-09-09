import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * 目录页离屏渲染成 PNG（给 AI 识图当第一证据，OCR 文本只当辅助）。
 *
 * 背景：小数字 OCR 检测框都出不来（第 8 页 1.1.1/1.2.3 行右边无 span，
 * 0.05 置信重跑/300dpi 同样没有），解析层再怎么配也变不出，只能让模型看图。
 * 与正文渲染共用同一 pdfDoc（各用独立离屏 canvas，不抢正文的画布）。
 */

export interface PdfPageImage {
  page: number
  blob: Blob
  width: number
  height: number
}

/** 单次最多渲染页数（目录范围通常 ≤8 页，防误传整本） */
export const MAX_SNAPSHOT_PAGES = 10

/**
 * 按页码顺序渲染，单页失败跳过不断整批。
 * scale 1.5：A4 页约 918px 宽，9pt 页码可辨，单张 PNG 通常 <1MB。
 */
export async function renderPdfPagesToPng(
  pdfDoc: PDFDocumentProxy,
  pages: readonly number[],
  scale = 1.5,
): Promise<PdfPageImage[]> {
  const wanted = pages.filter((page) => Number.isInteger(page) && page >= 1).slice(0, MAX_SNAPSHOT_PAGES)
  const out: PdfPageImage[] = []
  for (const pageNum of wanted) {
    try {
      const page = await pdfDoc.getPage(pageNum)
      try {
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const context = canvas.getContext('2d')
        if (!context) continue
        await page.render({ canvasContext: context, viewport, canvas }).promise
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((result) => resolve(result), 'image/png'),
        )
        if (!blob) continue
        out.push({ page: pageNum, blob, width: canvas.width, height: canvas.height })
      } finally {
        page.cleanup()
      }
    } catch {
      // 单页失败跳过，不阻断整理
    }
  }
  return out
}
