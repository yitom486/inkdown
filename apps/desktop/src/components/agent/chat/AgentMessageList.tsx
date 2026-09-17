import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  useAcpActiveMessages,
  useAcpPendingPermission,
  useAcpUiStore,
} from '@/stores/acp-ui-store'
import { AgentActivityGroup, groupAgentMessages } from '@/components/agent/chat/AgentActivityGroup'
import { AgentMessageBubble } from '@/components/agent/chat/AgentMessageBubble'
import { AgentPermissionCard } from '@/components/agent/permission/AgentPermissionCard'
import { shouldShowOrphanPermissionCard } from '@/lib/agent/acp-permission-ui'
import { logAcpLayoutProbe } from '@/lib/agent/acp-layout-probe'
import { useStickToBottomScroll } from '@/hooks/agent/useStickToBottomScroll'
import { useCodeBlockCopy } from '@/hooks/preview/useCodeBlockCopy'
import { AGENT_CHAT_COL_CLASS } from '@/components/agent/chat/AgentChatItem'
import { AgentScrollToBottomButton } from '@/components/agent/chat/AgentScrollToBottomButton'
import { AgentMark } from '@/components/agent/AgentMark'
import type { ChapterMarkPlanSelectPayload } from '@/components/agent/propose/ChapterMarkPlanCard'

interface AgentMessageListProps {
  bottomRef: RefObject<HTMLDivElement | null>
  messagesRef: RefObject<HTMLDivElement | null>
  authHint: string | null
  onChapterPlanSelect?: (payload: ChapterMarkPlanSelectPayload) => void
}

/**
 * 消息列表：只订阅消息相关状态，避免流式输出让 Agent 面板的标题栏和输入栏一起更新。
 */
export const AgentMessageList = memo(function AgentMessageList({
  bottomRef,
  messagesRef,
  authHint,
  onChapterPlanSelect,
}: AgentMessageListProps) {
  const messages = useAcpActiveMessages()
  const pendingPermission = useAcpPendingPermission()
  const prompting = useAcpUiStore((s) => s.prompting)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useCodeBlockCopy(messagesRef, messages)

  const timeline = useMemo(() => groupAgentMessages(messages), [messages])

  const streamingAny = messages.some((m) => m.streaming) || prompting
  const stickToBottomState = useMemo(
    () => ({
      messageCount: messages.length,
      lastMessageId: messages.at(-1)?.id,
      lastMessageStreaming: Boolean(messages.at(-1)?.streaming),
      prompting,
    }),
    [messages.length, messages.at(-1)?.id, messages.at(-1)?.streaming, prompting],
  )

  const { pinned, scrollToBottom } = useStickToBottomScroll({
    contentRef: messagesRef,
    messageState: stickToBottomState,
    streaming: streamingAny,
  })

  const pendingOrphan = shouldShowOrphanPermissionCard(pendingPermission, messages)

  useEffect(() => {
    if (!prompting) return
    setNowMs(Date.now())
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [prompting])

  const prevStreamingAny = useRef(streamingAny)

  useEffect(() => {
    const flipped = prevStreamingAny.current !== streamingAny
    prevStreamingAny.current = streamingAny
    const id = window.requestAnimationFrame(() => {
      logAcpLayoutProbe(messagesRef.current, {
        tag: 'AgentMessageList',
        role: 'list',
        streaming: streamingAny,
        force: flipped,
      })
    })
    return () => window.cancelAnimationFrame(id)
  }, [messages, messagesRef, streamingAny])

  return (
    <div className="relative min-h-0 min-w-0 flex-1">
      <ScrollArea
        className={cn(
          'h-full min-h-0 min-w-0 overflow-x-hidden',
          // Radix Viewport 内层常为 display:table + min-width:100%，长内容会撑开整列
          '[&_[data-slot=scroll-area-viewport]]:min-w-0',
          '[&_[data-slot=scroll-area-viewport]>div]:!block',
          '[&_[data-slot=scroll-area-viewport]>div]:!min-w-0',
          '[&_[data-slot=scroll-area-viewport]>div]:max-w-full',
        )}
      >
      <div
        ref={messagesRef}
        data-acp-probe="message-list"
        className={cn('flex flex-col gap-3 px-3 py-3', AGENT_CHAT_COL_CLASS)}
      >
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-3 py-4 text-center">
            <AgentMark className="mx-auto mb-2 size-6 text-muted-foreground/60" />
            <p className="text-xs font-medium text-foreground/80">开始与 Codex 对话</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              点击右上角连接。复用本机 Codex 登录或环境变量中的 API Key。
            </p>
            {authHint ? (
              <p
                className={cn(
                  'mt-2 rounded-md px-2 py-1.5 text-[10px] leading-relaxed',
                  authHint.startsWith('已检测')
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
                )}
              >
                {authHint}
              </p>
            ) : null}
          </div>
        ) : null}
        {timeline.map((item) =>
          item.type === 'activity' ? (
            <AgentActivityGroup
              key={item.messages.map((m) => m.id).join('-')}
              messages={item.messages}
              nowMs={nowMs}
              onChapterPlanSelect={onChapterPlanSelect}
            />
          ) : (
            <AgentMessageBubble
              key={item.message.id}
              message={item.message}
              onChapterPlanSelect={onChapterPlanSelect}
            />
          ),
        )}
        {prompting && !messages.some((m) => m.streaming) ? (
          <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            正在生成…
          </div>
        ) : null}
        {pendingOrphan && pendingPermission ? (
          <AgentPermissionCard pending={pendingPermission} />
        ) : null}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
      {!pinned && messages.length > 0 ? (
        <AgentScrollToBottomButton onClick={scrollToBottom} />
      ) : null}
    </div>
  )
})
