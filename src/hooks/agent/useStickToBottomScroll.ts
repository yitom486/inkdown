import { useEffect, useRef, type RefObject } from 'react'
import {
  DEFAULT_STICK_TO_BOTTOM_THRESHOLD_PX,
  isNearBottom,
  resolveScrollViewport,
  scrollViewportToBottom,
  shouldRePinOnMessageChange,
  type MessagePinState,
} from '@/lib/agent/stick-to-bottom'

interface UseStickToBottomScrollOptions {
  contentRef: RefObject<HTMLElement | null>
  messageState: MessagePinState
  thresholdPx?: number
}

/**
 * Agent 消息列表贴底滚动：仅在用户位于底部附近时跟随内容增高；
 * 用户上滑阅读后停止自动滚动，新消息或新一轮流式再贴底。
 */
export function useStickToBottomScroll({
  contentRef,
  messageState,
  thresholdPx = DEFAULT_STICK_TO_BOTTOM_THRESHOLD_PX,
}: UseStickToBottomScrollOptions): void {
  const pinnedRef = useRef(true)
  const programmaticRef = useRef(false)
  const prevMessageStateRef = useRef<MessagePinState>(messageState)

  useEffect(() => {
    if (shouldRePinOnMessageChange(prevMessageStateRef.current, messageState)) {
      pinnedRef.current = true
      const viewport = resolveScrollViewport(contentRef.current)
      if (viewport) {
        programmaticRef.current = true
        scrollViewportToBottom(viewport)
        requestAnimationFrame(() => {
          programmaticRef.current = false
        })
      }
    }
    prevMessageStateRef.current = messageState
  }, [contentRef, messageState])

  useEffect(() => {
    const content = contentRef.current
    const viewport = resolveScrollViewport(content)
    if (!content || !viewport) return

    const syncPinnedFromScroll = () => {
      if (programmaticRef.current) return
      pinnedRef.current = isNearBottom(viewport, thresholdPx)
    }

    const followBottomIfPinned = () => {
      if (!pinnedRef.current) return
      programmaticRef.current = true
      scrollViewportToBottom(viewport)
      requestAnimationFrame(() => {
        programmaticRef.current = false
      })
    }

    viewport.addEventListener('scroll', syncPinnedFromScroll, { passive: true })

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => followBottomIfPinned())
        : null
    resizeObserver?.observe(content)

    followBottomIfPinned()

    return () => {
      viewport.removeEventListener('scroll', syncPinnedFromScroll)
      resizeObserver?.disconnect()
    }
  }, [contentRef, thresholdPx])
}
