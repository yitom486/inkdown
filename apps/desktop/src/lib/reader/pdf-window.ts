/**
 * PDF 虚拟窗口纯函数（零依赖，不引 pdfjs-dist）。
 * 从 `pdf-render.ts` 抽出：bun 脚本与单测可直接引用，渲染器经由 `pdf-render` re-export 使用。
 */

/** 连续滚动时预渲染当前页前后各几页 */
export const PDF_PAGE_RENDER_BUFFER = 2

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
