export const DEFAULT_STICK_TO_BOTTOM_THRESHOLD_PX = 96

export type StickToBottomViewport = Pick<
  HTMLElement,
  'scrollTop' | 'scrollHeight' | 'clientHeight'
>

export function isNearBottom(
  viewport: StickToBottomViewport,
  threshold = DEFAULT_STICK_TO_BOTTOM_THRESHOLD_PX,
): boolean {
  const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
  return distance <= threshold
}

export type MessagePinState = {
  messageCount: number
  lastMessageId?: string
  lastMessageStreaming?: boolean
  prompting?: boolean
}

/** 新消息、新回复开始流式、用户刚发送 prompt 时重新贴底。历史懒加载向前补（条数涨但末条不变）不贴底。 */
export function shouldRePinOnMessageChange(
  prev: MessagePinState,
  next: MessagePinState,
): boolean {
  if (next.messageCount > prev.messageCount) {
    // 条数涨 + 末条变 = 末尾追加 → 贴底；条数涨 + 末条不变 = 历史前补 → 不贴
    return next.lastMessageId !== prev.lastMessageId
  }
  if (next.lastMessageId !== prev.lastMessageId) return true
  if (next.lastMessageStreaming && !prev.lastMessageStreaming) return true
  if (next.prompting && !prev.prompting) return true
  return false
}

export function resolveScrollViewport(
  contentEl: HTMLElement | null | undefined,
): HTMLElement | null {
  if (!contentEl) return null
  const viewport = contentEl.closest('[data-slot=scroll-area-viewport]')
  if (viewport instanceof HTMLElement) return viewport
  const parent = contentEl.parentElement
  if (parent instanceof HTMLElement) {
    const style = getComputedStyle(parent)
    if (/(auto|scroll)/.test(style.overflowY)) return parent
  }
  return parent instanceof HTMLElement ? parent : null
}

export function scrollViewportToBottom(viewport: HTMLElement): void {
  viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight
}

/** 将高频回调合并到下一帧，避免 ResizeObserver 在流式输出时过度触发滚动。 */
export function rafCoalesce(callback: () => void): () => void {
  let scheduled = false
  return () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      callback()
    })
  }
}

/** 历史分页：初次只看末尾，向上滚动 5 条 5 条向前补。 */
export const CHAT_HISTORY_INITIAL_COUNT = 5
export const CHAT_HISTORY_PAGE_STEP = 5

/**
 * 聊天可见窗口切片（纯函数）。
 * - start 为 null：贴底锚定，取末尾 count 条（新消息自然进入视野）；
 * - start 为数字：冻结窗口 [start, start+count)，新消息到来不移位（供未贴底时保持位置）。
 * 越界钳制；总量不足返回全部。
 */
export function sliceChatWindow<T>(messages: T[], start: number | null, count: number): T[] {
  if (messages.length <= count || start === null) return messages.slice(-count)
  const clamped = Math.max(0, Math.min(start, messages.length - 1))
  return messages.slice(clamped, clamped + count)
}
