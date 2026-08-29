import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  ListTodo,
  Loader2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { summarizePlanProgress } from '@/lib/acp-plan'
import type { AcpChatMessage } from '@/stores/acp-chat-types'

interface AgentPlanCardProps {
  message: AcpChatMessage
}

function StatusIcon({ status }: { status?: string }) {
  if (status === 'completed') {
    return <Check className="size-3.5 shrink-0 text-emerald-500" />
  }
  if (status === 'in_progress') {
    return <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-500" />
  }
  if (status === 'cancelled') {
    return <Circle className="size-3.5 shrink-0 text-muted-foreground/50" />
  }
  return <Circle className="size-3.5 shrink-0 text-muted-foreground/70" />
}

export function AgentPlanCard({ message }: AgentPlanCardProps) {
  const entries = message.planEntries ?? []
  const summary = summarizePlanProgress(entries)
  const active = Boolean(message.streaming) || summary.active
  const [open, setOpen] = useState(active)

  useEffect(() => {
    setOpen(active)
  }, [active])

  const title = active
    ? `计划 · ${summary.completed}/${summary.total}`
    : `计划完成 · ${summary.completed}/${summary.total}`

  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-muted/10',
        active && 'border-sky-500/25 bg-sky-500/5',
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {active ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-sky-500" />
        ) : open ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <ListTodo className="size-3.5 shrink-0 text-sky-500/80" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/90">
          {title}
        </span>
      </button>

      {open ? (
        <ul className="space-y-1 border-t border-border/40 px-2.5 py-2">
          {entries.map((entry, index) => (
            <li
              key={`${index}-${entry.content.slice(0, 24)}`}
              className="flex items-start gap-2 text-[11px] leading-relaxed"
            >
              <StatusIcon status={entry.status} />
              <span
                className={cn(
                  'min-w-0 flex-1',
                  entry.status === 'completed' && 'text-muted-foreground line-through',
                  entry.status === 'in_progress' && 'text-foreground',
                  entry.status === 'pending' && 'text-muted-foreground',
                )}
              >
                {entry.content}
                {entry.priority ? (
                  <span className="ml-1.5 text-[10px] opacity-60">{entry.priority}</span>
                ) : null}
              </span>
            </li>
          ))}
          {entries.length === 0 ? (
            <li className="text-[10px] text-muted-foreground">暂无计划条目</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
