import { ChevronDown, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import {
  AgentChatItem,
  AgentChatItemBody,
  useAgentChatOpen,
} from '@/components/agent/AgentChatItem'
import { AgentToolCallCard } from '@/components/agent/AgentToolCallCard'
import { AgentPlanCard } from '@/components/agent/AgentPlanCard'
import {
  ChapterMarkPlanCard,
  type ChapterMarkPlanSelectPayload,
} from '@/components/agent/ChapterMarkPlanCard'
import { ProposeMarkBlockList, ProposeMarkChatBlock } from '@/components/agent/ProposeMarkChatBlock'
import type { ResolveMarkProposal } from '@/components/agent/AgentBlockRenderer'
import { dismissProposedMark } from '@/lib/agent/context/propose-mark'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { renderAgentMarkdown } from '@/lib/agent/agent-markdown'
import { cn } from '@/lib/utils'
import type { AcpChatMessage } from '@/stores/acp-chat-types'
import '@/styles/markdown-preview.css'

interface AgentMessageBubbleProps {
  message: AcpChatMessage
  resolveMarkProposal?: ResolveMarkProposal
  onChapterPlanSelect?: (payload: ChapterMarkPlanSelectPayload) => void
}

export function AgentMessageBubble({
  message,
  resolveMarkProposal,
  onChapterPlanSelect,
}: AgentMessageBubbleProps) {
  const resolveFromStore = useAcpUiStore((s) => s.resolveMarkProposal)
  const resolve = resolveMarkProposal ?? resolveFromStore

  const handleResolved: ResolveMarkProposal = (proposalId, status) => {
    resolve(proposalId, status)
    if (status === 'adopted' || status === 'dismissed') dismissProposedMark()
  }
  const [thoughtOpen, setThoughtOpen] = useAgentChatOpen(Boolean(message.streaming))

  const html = useMemo(() => {
    if (message.role !== 'agent') return null
    if (!message.text.trim() && message.streaming) return null
    // 流式与完成共用同一渲染管线，仅 streaming 时补全未闭合 fence
    return renderAgentMarkdown(message.text, { streaming: Boolean(message.streaming) })
  }, [message.text, message.role, message.streaming])

  if (message.role === 'system') {
    return (
      <AgentChatItem variant="system" probe="system" messageId={message.id} role="system">
        {message.text}
      </AgentChatItem>
    )
  }

  if (message.role === 'tool') {
    if (message.markProposal && message.markProposalStatus !== 'dismissed') {
      return (
        <ProposeMarkChatBlock
          proposal={message.markProposal}
          status={message.markProposalStatus ?? 'pending'}
          onResolved={(status) => handleResolved(message.markProposal!.id, status)}
        />
      )
    }
    return (
      <AgentToolCallCard message={message} />
    )
  }

  if (message.role === 'plan') {
    return <AgentPlanCard message={message} />
  }

  if (message.role === 'thought') {
    const preview = message.text.replace(/\s+/g, ' ').trim()
    const collapsedLabel = message.streaming
      ? '思考中'
      : preview
        ? `思考 · ${preview.slice(0, 48)}${preview.length > 48 ? '…' : ''}`
        : '思考'

    return (
      <AgentChatItem
        variant="card"
        tone="thought"
        streaming={Boolean(message.streaming)}
        probe="thought"
        messageId={message.id}
        role="thought"
      >
        <button
          type="button"
          className="flex w-full min-w-0 items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground"
          onClick={() => setThoughtOpen((v) => !v)}
        >
          {thoughtOpen ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
          <Sparkles className="size-3.5 shrink-0 text-amber-500/80" />
          <span className="min-w-0 flex-1 truncate">
            {thoughtOpen ? (message.streaming ? '思考中' : '思考') : collapsedLabel}
          </span>
          {message.streaming ? (
            <Loader2 className="size-3 shrink-0 animate-spin text-amber-500" />
          ) : null}
        </button>
        {thoughtOpen ? (
          <AgentChatItemBody className="border-border/30 text-[11px] leading-relaxed text-muted-foreground italic">
            <div className="min-w-0 break-words border-l-2 border-amber-500/30 pl-2.5 whitespace-pre-wrap [overflow-wrap:anywhere]">
              {message.text}
              {message.streaming ? (
                <span className="ml-1 inline-block h-2.5 w-1 animate-pulse rounded-sm bg-amber-500/60 align-middle" />
              ) : null}
            </div>
          </AgentChatItemBody>
        ) : null}
      </AgentChatItem>
    )
  }

  const isUser = message.role === 'user'
  const showEmptyStreaming = !isUser && message.streaming && !message.text.trim()

  return (
    <AgentChatItem
      variant="bubble"
      tone={isUser ? 'user' : 'agent'}
      align={isUser ? 'end' : 'start'}
      streaming={Boolean(message.streaming)}
      probe={isUser ? 'user' : 'agent'}
      messageId={message.id}
      role={message.role}
    >
      {!isUser ? (
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Agent
          {message.streaming ? (
            <Loader2 className="size-3 animate-spin text-emerald-500" />
          ) : null}
        </div>
      ) : null}

      {isUser ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          {(message.attachments?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {message.attachments!.map((att) => (
                <div
                  key={att.id}
                  className={cn(
                    'inline-flex max-w-[11rem] items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                    'border-primary-foreground/30 bg-primary-foreground/12',
                  )}
                  title={att.absolutePath ?? att.name}
                >
                  {att.kind === 'image' && att.previewUrl ? (
                    <img
                      src={att.previewUrl}
                      alt=""
                      className="size-5 shrink-0 rounded object-cover"
                    />
                  ) : null}
                  <span className="min-w-0 truncate">{att.name}</span>
                </div>
              ))}
            </div>
          ) : null}
          {message.text.trim() ? (
            <div className="min-w-0 break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
              {message.text}
            </div>
          ) : null}
        </div>
      ) : showEmptyStreaming ? (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex gap-1">
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.2s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.1s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
          </span>
          正在生成
        </div>
      ) : (
        <MarkdownContent
          html={html ?? ''}
          deferMermaid={Boolean(message.streaming)}
          className={cn(
            'markdown-preview agent-md min-w-0 max-w-full break-words text-[12px] [overflow-wrap:anywhere]',
            '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
            '[&_.mermaid]:my-2 [&_.mermaid]:overflow-x-auto [&_.mermaid]:rounded-md [&_.mermaid]:bg-muted/40 [&_.mermaid]:p-2',
          )}
        />
      )}
      {(message.markProposals?.length ?? 0) > 0 ? (
        <ProposeMarkBlockList
          embedded
          proposals={message.markProposals!.map((row) => ({
            proposal: row.proposal,
            status: row.status,
          }))}
          onResolved={handleResolved}
        />
      ) : null}
      {(message.chapterMarkPlan?.length ?? 0) > 0 ? (
        <ChapterMarkPlanCard
          embedded
          entries={message.chapterMarkPlan!}
          onSelectChapter={onChapterPlanSelect}
        />
      ) : null}
      {message.streaming && !isUser && !showEmptyStreaming ? (
        <span className="mt-0.5 inline-block h-3.5 w-0.5 animate-pulse rounded-sm bg-foreground/60 align-middle" />
      ) : null}
    </AgentChatItem>
  )
}
