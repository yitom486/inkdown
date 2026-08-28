export interface ScrollBoundaryState {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

/** 滚轮在滚动容器边界时是否应触发上一页/下一页 */
export function resolveWheelPageTurn(
  deltaY: number,
  scroll: ScrollBoundaryState,
  threshold = 1,
): 'prev' | 'next' | null {
  if (deltaY === 0) return null

  const atTop = scroll.scrollTop <= threshold
  const atBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - threshold
  const canScroll = scroll.scrollHeight > scroll.clientHeight + threshold

  if (deltaY > 0 && (!canScroll || atBottom)) return 'next'
  if (deltaY < 0 && (!canScroll || atTop)) return 'prev'
  return null
}
