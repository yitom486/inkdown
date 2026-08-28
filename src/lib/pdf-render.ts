import { RenderingCancelledException } from 'pdfjs-dist'
import type { PDFPageProxy } from 'pdfjs-dist'

/** pdf.js 取消渲染或 canvas 并发冲突时不应向用户报错 */
export function isPdfRenderCancelled(cause: unknown): boolean {
  if (cause instanceof RenderingCancelledException) return true
  if (cause instanceof Error) {
    return (
      cause.name === 'RenderingCancelledException' ||
      cause.message.includes('Rendering cancelled') ||
      cause.message.includes('same canvas during multiple render')
    )
  }
  return false
}

/** 连续滚动时预渲染当前页前后各几页 */
export const PDF_PAGE_RENDER_BUFFER = 2

export function getPdfDevicePixelRatio(dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1
  return Math.min(Math.max(dpr, 1), 3)
}

export function resolvePdfVisiblePageRange(
  currentPage: number,
  numPages: number,
  buffer = PDF_PAGE_RENDER_BUFFER,
): { start: number; end: number } {
  const safeCurrent = Math.min(Math.max(currentPage, 1), Math.max(numPages, 1))
  return {
    start: Math.max(1, safeCurrent - buffer),
    end: Math.min(numPages, safeCurrent + buffer),
  }
}

export function shouldRenderPdfPage(
  pageNumber: number,
  currentPage: number,
  numPages: number,
  buffer = PDF_PAGE_RENDER_BUFFER,
): boolean {
  const { start, end } = resolvePdfVisiblePageRange(currentPage, numPages, buffer)
  return pageNumber >= start && pageNumber <= end
}

/** 按 CSS 像素算视口，canvas 用 DPR 放大以保证清晰度 */
export function createPdfPageViewport(page: PDFPageProxy, scale: number, dpr = getPdfDevicePixelRatio()) {
  const cssViewport = page.getViewport({ scale })
  const renderViewport = page.getViewport({ scale: scale * dpr })
  return { cssViewport, renderViewport, dpr }
}
