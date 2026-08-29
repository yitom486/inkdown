import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AgentMessageBubble } from '@/components/agent/AgentMessageBubble'
import { cn } from '@/lib/utils'
import type { AcpChatMessage } from '@/stores/acp-chat-types'
import { formatDuration } from '@/stores/acp-chat-types'
import { useAcpPendingPermission } from '@/stores/acp-ui-store'

interface AgentActivityGroupProps {
  messages: AcpChatMessage[]
  /** 用于进行中实时刷新时长 */
  nowMs?: number
}

export function AgentActivityGroup({ messages, nowMs }: AgentActivityGroupProps) {
  const pendingPermission = useAcpPendingPermission()
  const awaitingPermission = messages.some(
    (m) =>
      m.role === 'tool' &&
      pendingPermission?.toolCallId &&
      m.toolCallId === pendingPermission.toolCallId,
  )
  const active = messages.some((m) => m.streaming) || awaitingPermission
  const [open, setOpen] = useState(active)

  useEffect(() => {
    setOpen(active)
  }, [active])

  const startedAt = messages[0]?.createdAt ?? Date.now()
  const endedAt = useMemo(() => {
    if (active) return nowMs ?? Date.now()
    return Math.max(
      startedAt,
      ...messages.map((m) => m.updatedAt ?? m.createdAt),
    )
  }, [active, messages, nowMs, startedAt])

  const durationLabel = formatDuration(Math.max(0, endedAt - startedAt))
  const stepCount = messages.length
  const toolCount = messages.filter((m) => m.role === 'tool').length
  const thoughtCount = messages.filter((m) => m.role === 'thought').length
  const planCount = messages.filter((m) => m.role === 'plan').length

  const summary = active
    ? awaitingPermission
      ? `等待批准 · ${durationLabel}`
      : `工作中 · ${durationLabel}`
    : `工作了 ${durationLabel} · ${stepCount} 步`

  const sub =
    !active && (toolCount > 0 || thoughtCount > 0 || planCount > 0)
      ? [
          thoughtCount > 0 ? `思考 ${thoughtCount}` : null,
          planCount > 0 ? `计划 ${planCount}` : null,
          toolCount > 0 ? `工具 ${toolCount}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null

  return (
    <div
      className={cn(
        'rounded-xl border border-border/40 bg-muted/10',
        active && 'border-amber-500/20 bg-amber-500/[0.04]',
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {active ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-500" />
        ) : open ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">
          {summary}
          {sub ? <span className="ml-1.5 font-normal opacity-80">（{sub}）</span> : null}
        </span>
      </button>

      {open ? (
        <div className="space-y-2 border-t border-border/30 px-2 py-2">
          {messages.map((msg) => (
            <AgentMessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export type AgentTimelineItem =
  | { type: 'single'; message: AcpChatMessage }
  | { type: 'activity'; messages: AcpChatMessage[] }

/** 将连续 thought/tool 收成活动组，对齐 Cursor「Worked for」 */
export function groupAgentMessages(messages: AcpChatMessage[]): AgentTimelineItem[] {
  const items: AgentTimelineItem[] = []
  let buffer: AcpChatMessage[] = []

  const flush = () => {
    if (buffer.length === 0) return
    if (buffer.length === 1 && buffer[0]!.role === 'thought') {
      // 单条思考仍进活动组，统一折叠体验
      items.push({ type: 'activity', messages: buffer })
    } else if (buffer.length === 1) {
      items.push({ type: 'activity', messages: buffer })
    } else {
      items.push({ type: 'activity', messages: buffer })
    }
    buffer = []
  }

  for (const msg of messages) {
    if (msg.role === 'thought' || msg.role === 'tool' || msg.role === 'plan') {
      buffer.push(msg)
      continue
    }
    flush()
    items.push({ type: 'single', message: msg })
  }
  flush()
  return items
}
