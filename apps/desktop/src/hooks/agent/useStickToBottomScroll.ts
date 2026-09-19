import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  DEFAULT_STICK_TO_BOTTOM_THRESHOLD_PX,
  isNearBottom,
  rafCoalesce,
  resolveScrollViewport,
  scrollViewportToBottom,
  shouldRePinOnMessageChange,
  type MessagePinState,
} from '@/lib/agent/stick-to-bottom'

export interface ChatScrollSnapshot {
  scrollTop: number
  pinned: boolean
}

interface UseStickToBottomScrollOptions {
  contentRef: RefObject<HTMLElement | null>
  messageState: MessagePinState
  thresholdPx?: number
  /** 流式输出时用 rAF 合并 ResizeObserver 回调，减轻代码块增高时的滚动抖动。 */
  streaming?: boolean
  /** 滚动记忆归属（线程 id）：切换线程/重挂载时按此恢复，悬浮与侧栏共用。 */
  threadId?: string
  /** 读取该线程上次关闭时的滚动快照；缺省视为新会话（贴底）。 */
  loadScroll?: () => ChatScrollSnapshot | undefined
  /** 用户滚动时回写快照（内部 rAF 节流）；卸载时强制刷盘一次。 */
  saveScroll?: (next: ChatScrollSnapshot) => void
}

interface UseStickToBottomScrollResult {
  /** 是否贴在底部（未上滑离开）。 */
  pinned: boolean
  scrollToBottom: () => void
}

/**
 * Agent 消息列表贴底滚动 + 位置记忆：
 * - 仅在用户位于底部附近时跟随内容增高；上滑后停止，新消息不再拽回；
 * - 关闭/切换悬浮与侧栏/切换线程时记住位置，重开原位瞬间恢复（无滑动动画）；
 * - 挂载时不再无条件跳底：记忆贴底才到底，否则回到上次 scrollTop。
 */
export function useStickToBottomScroll({
  contentRef,
  messageState,
  thresholdPx = DEFAULT_STICK_TO_BOTTOM_THRESHOLD_PX,
  streaming = false,
  threadId,
  loadScroll,
  saveScroll,
}: UseStickToBottomScrollOptions): UseStickToBottomScrollResult {
  const [pinned, setPinned] = useState(() => loadScroll?.()?.pinned ?? true)
  const pinnedRef = useRef<boolean>(loadScroll?.()?.pinned ?? true)
  const programmaticRef = useRef(false)
  const prevMessageStateRef = useRef<MessagePinState>(messageState)
  const messageStateRef = useRef(messageState)
  messageStateRef.current = messageState
  const saveScrollRef = useRef(saveScroll)
  saveScrollRef.current = saveScroll

  const flushSave = useCallback(() => {
    const viewport = resolveScrollViewport(contentRef.current)
    if (!viewport) return
    saveScrollRef.current?.({ scrollTop: viewport.scrollTop, pinned: pinnedRef.current })
  }, [contentRef])

  const scrollToBottom = useCallback(() => {
    const viewport = resolveScrollViewport(contentRef.current)
    if (!viewport) return
    pinnedRef.current = true
    setPinned(true)
    programmaticRef.current = true
    scrollViewportToBottom(viewport)
    requestAnimationFrame(() => {
      programmaticRef.current = false
    })
  }, [contentRef])

  // 原位恢复：挂载与线程切换时按记忆定位（瞬间完成，无动画）。
  // 注意：同时把消息基线重置为当前，避免切线程被误判为“新消息”而跳底。
  useEffect(() => {
    prevMessageStateRef.current = messageStateRef.current
    const viewport = resolveScrollViewport(contentRef.current)
    if (!viewport) return
    const saved = loadScroll?.()
    const pinnedNext = saved?.pinned ?? true
    pinnedRef.current = pinnedNext
    setPinned(pinnedNext)
    programmaticRef.current = true
    if (saved && !saved.pinned) {
      viewport.scrollTop = saved.scrollTop
    } else {
      scrollViewportToBottom(viewport)
    }
    requestAnimationFrame(() => {
      programmaticRef.current = false
    })
    // 仅响应线程切换与挂载；loadScroll/contentRef 引用稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  useEffect(() => {
    if (shouldRePinOnMessageChange(prevMessageStateRef.current, messageState)) {
      scrollToBottom()
    }
    prevMessageStateRef.current = messageState
  }, [messageState, scrollToBottom])

  useEffect(() => {
    const content = contentRef.current
    const viewport = resolveScrollViewport(content)
    if (!content || !viewport) return

    let saveScheduled = false
    const scheduleSave = () => {
      if (saveScheduled) return
      saveScheduled = true
      requestAnimationFrame(() => {
        saveScheduled = false
        flushSave()
      })
    }

    const syncPinnedFromScroll = () => {
      if (programmaticRef.current) return
      const near = isNearBottom(viewport, thresholdPx)
      pinnedRef.current = near
      setPinned(near)
      scheduleSave()
    }

    const followBottomIfPinned = () => {
      if (!pinnedRef.current) return
      programmaticRef.current = true
      scrollViewportToBottom(viewport)
      requestAnimationFrame(() => {
        programmaticRef.current = false
      })
    }

    const onResize = streaming ? rafCoalesce(followBottomIfPinned) : followBottomIfPinned

    viewport.addEventListener('scroll', syncPinnedFromScroll, { passive: true })

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => onResize()) : null
    resizeObserver?.observe(content)

    return () => {
      viewport.removeEventListener('scroll', syncPinnedFromScroll)
      resizeObserver?.disconnect()
      // 卸载刷盘：关闭面板/切换形态时记住最后位置
      flushSave()
    }
  }, [contentRef, streaming, thresholdPx, flushSave])

  return { pinned, scrollToBottom }
}
