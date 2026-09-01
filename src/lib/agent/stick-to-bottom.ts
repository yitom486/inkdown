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

/** 新消息、新回复开始流式、用户刚发送 prompt 时重新贴底。 */
export function shouldRePinOnMessageChange(
  prev: MessagePinState,
  next: MessagePinState,
): boolean {
  if (next.messageCount > prev.messageCount) return true
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
  return parent instanceof HTMLElement ? parent : null
}

export function scrollViewportToBottom(viewport: HTMLElement): void {
  viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight
}
