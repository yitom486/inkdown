import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AgentToolCallCard } from '@/components/agent/AgentToolCallCard'
import { renderAgentMarkdown } from '@/lib/agent-markdown'
import { cn } from '@/lib/utils'
import type { AcpChatMessage } from '@/stores/acp-chat-types'

interface AgentMessageBubbleProps {
  message: AcpChatMessage
}

export function AgentMessageBubble({ message }: AgentMessageBubbleProps) {
  const [thoughtOpen, setThoughtOpen] = useState(Boolean(message.streaming))
  const html = useMemo(() => {
    if (message.role === 'system' || message.role === 'user' || message.role === 'tool') {
      return null
    }
    if (message.role === 'thought') return null
    return renderAgentMarkdown(message.text)
  }, [message.role, message.text])

  useEffect(() => {
    // 主流 IDE：思考进行中展开，结束后自动折叠，仍可手动点开
    setThoughtOpen(Boolean(message.streaming))
  }, [message.streaming])

  if (message.role === 'system') {
    return (
      <div className="px-1 py-0.5 text-center text-[11px] text-muted-foreground/80">
        {message.text}
      </div>
    )
  }

  if (message.role === 'tool') {
    return <AgentToolCallCard message={message} />
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
            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          ) : null}
        </button>
        {thoughtOpen ? (
          <div className="border-t border-border/30 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground italic">
            <div className="border-l-2 border-amber-500/30 pl-2.5">
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
        )}
      >
        {!isUser ? (
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Agent
            {message.streaming ? (
              <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            ) : null}
          </div>
        ) : null}

        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.text}</div>
        ) : (
          <div
            className={cn(
              'agent-md break-words',
              '[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
              '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4',
              '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4',
              '[&_li]:my-0.5',
              '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted/80 [&_pre]:p-2',
              '[&_code]:rounded [&_code]:bg-muted/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px]',
              '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
              '[&_a]:text-primary [&_a]:underline',
              '[&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-sm [&_h1]:font-semibold',
              '[&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold',
              '[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-xs [&_h3]:font-semibold',
            )}
            dangerouslySetInnerHTML={{ __html: html ?? '' }}
          />
        )}
        {message.streaming && !isUser ? (
          <span className="mt-0.5 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-foreground/50 align-middle" />
        ) : null}
      </div>
    </div>
  )
}
