/** 连续滚动页间距，对应 Tailwind gap-4 */
export const PDF_PAGE_GAP_PX = 16

/** 远距离跳转后，在真实页高度落定前抑制滚动回写页码的时长上限 */
export const PDF_JUMP_SYNC_HOLD_MS = 800

export function estimatePageOffsetTop(
  pageNumber: number,
  pageHeight: number,
  gap = PDF_PAGE_GAP_PX,
): number {
  if (pageNumber <= 1) return 0
  return (pageNumber - 1) * (pageHeight + gap)
}

/** 将滚动容器对齐到目标页锚点；锚点尚未挂载时回退到等高估算。 */
export function resolvePdfPageScrollTop(
  targetPage: number,
  pageHeight: number,
  anchorOffsetTop: number | null,
  gap = PDF_PAGE_GAP_PX,
  paddingTop = 16,
): number {
  if (anchorOffsetTop != null && Number.isFinite(anchorOffsetTop)) {
    return Math.max(0, anchorOffsetTop - paddingTop)
  }
  return Math.max(0, estimatePageOffsetTop(targetPage, pageHeight, gap))
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
