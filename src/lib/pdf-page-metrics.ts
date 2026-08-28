/** 连续滚动页间距，对应 Tailwind gap-4 */
export const PDF_PAGE_GAP_PX = 16

export function estimatePageOffsetTop(
  pageNumber: number,
  pageHeight: number,
  gap = PDF_PAGE_GAP_PX,
): number {
  if (pageNumber <= 1) return 0
  return (pageNumber - 1) * (pageHeight + gap)
}

export interface PdfPageCssSize {
  width: number
  height: number
}

/** 由首页 viewport 推算缩放后的 CSS 页尺寸 */
export function scalePdfPageCssSize(base: PdfPageCssSize, scale: number): PdfPageCssSize {
  return {
    width: base.width * scale,
    height: base.height * scale,
  }
}
