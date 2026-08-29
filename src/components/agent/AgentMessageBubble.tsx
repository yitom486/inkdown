import { ChevronDown, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { AgentToolCallCard } from '@/components/agent/AgentToolCallCard'
import { AgentPlanCard } from '@/components/agent/AgentPlanCard'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import {
  renderAgentMarkdown,
  renderAgentMarkdownStreaming,
} from '@/lib/agent-markdown'
import { mermaidLog } from '@/lib/mermaid-debug'
import { cn } from '@/lib/utils'
import type { AcpChatMessage } from '@/stores/acp-chat-types'
import '@/styles/markdown-preview.css'

interface AgentMessageBubbleProps {
  message: AcpChatMessage
}

export function AgentMessageBubble({ message }: AgentMessageBubbleProps) {
  const [thoughtOpen, setThoughtOpen] = useState(Boolean(message.streaming))
  const deferredText = useDeferredValue(message.text)
  /** 非流式用最终文本，避免 deferred 滞后导致 Mermaid 用到半截 fence */
  const textForMd = message.streaming ? deferredText : message.text

  const html = useMemo(() => {
    if (message.role !== 'agent') return null
    if (!textForMd.trim() && message.streaming) return null
    if (message.streaming) return renderAgentMarkdownStreaming(textForMd)
    return renderAgentMarkdown(textForMd)
  }, [textForMd, message.role, message.streaming])

  useEffect(() => {
    if (message.streaming) {
      mermaidLog('bubble:streaming', { textChars: textForMd.length })
    }
  }, [message.streaming, textForMd.length])

  useEffect(() => {
    setThoughtOpen(Boolean(message.streaming))
  }, [message.streaming])

  if (message.role === 'system') {
    return (
      <div className="px-1 py-0.5 text-center text-[10px] text-muted-foreground/70">
        {message.text}
      </div>
    )
  }

  if (message.role === 'tool') {
    return <AgentToolCallCard message={message} />
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
      <div className="rounded-xl border border-border/40 bg-muted/10">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground"
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
          <div className="border-t border-border/30 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground italic">
            <div className="border-l-2 border-amber-500/30 pl-2.5 whitespace-pre-wrap">
              {message.text}
              {message.streaming ? (
                <span className="ml-1 inline-block h-2.5 w-1 animate-pulse rounded-sm bg-amber-500/60 align-middle" />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const isUser = message.role === 'user'
  const showEmptyStreaming = !isUser && message.streaming && !message.text.trim()

  return (
    <div
      className={cn(
        'group flex flex-col gap-1',
        isUser ? 'items-end' : 'items-start',
      )}
    >
      <div
        className={cn(
          'max-w-[95%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed shadow-sm',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md border border-border/60 bg-card text-card-foreground',
          message.streaming && !isUser && 'ring-1 ring-emerald-500/20',
        )}
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
          <div className="flex flex-col gap-1.5">
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
              <div className="whitespace-pre-wrap break-words">{message.text}</div>
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
              'markdown-preview agent-md break-words text-[12px]',
              '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
              '[&_.mermaid]:my-2 [&_.mermaid]:overflow-x-auto [&_.mermaid]:rounded-md [&_.mermaid]:bg-muted/40 [&_.mermaid]:p-2',
            )}
          />
        )}
        {message.streaming && !isUser && !showEmptyStreaming ? (
          <span className="mt-0.5 inline-block h-3.5 w-0.5 animate-pulse rounded-sm bg-foreground/60 align-middle" />
        ) : null}
      </div>
    </div>
  )
}
