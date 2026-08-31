import { Bookmark, ChevronDown, ChevronRight, Highlighter } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import {
  AgentChatItem,
  AgentChatItemBody,
} from '@/components/agent/AgentChatItem'
import { ProposeMarkCard } from '@/components/agent/ProposeMarkCard'
import { cn } from '@/lib/utils'
import type { MarkProposalStatus, ProposedMark } from '@shared/types/mark-proposal'

interface ProposeMarkChatBlockProps {
  proposal: ProposedMark
  status?: MarkProposalStatus
  /** 待确认默认折叠；批注小窗等可传 true */
  defaultExpanded?: boolean
  embedded?: boolean
  className?: string
  onNoteChange?: (note: string) => void
  onAdopt?: (note: string) => void | Promise<void>
  onDismiss?: () => void
  onResolved?: (status: Exclude<MarkProposalStatus, 'pending'>) => void
  extraActions?: ReactNode
}

function excerptPreview(excerpt: string, max = 28): string {
  const text = excerpt.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function collapsedLabel(
  proposal: ProposedMark,
  status: MarkProposalStatus,
): string {
  const kind = proposal.kind === 'highlight' ? '高亮' : '批注'
  const preview = excerptPreview(proposal.excerpt)
  if (status === 'adopted') return `已保存${kind}`
  if (status === 'dismissed') return `已忽略${kind}提议`
  if (preview) return `${kind}草稿 · ${preview} · 待确认`
  return `${kind}草稿 · 待确认`
}

/** 聊天气泡内可折叠提议块（权限卡 / 工具卡同级视觉）。 */
export function ProposeMarkChatBlock({
  proposal,
  status = 'pending',
  defaultExpanded = false,
  embedded = false,
  className,
  onNoteChange,
  onAdopt,
  onDismiss,
  onResolved,
  extraActions,
}: ProposeMarkChatBlockProps) {
  const pending = status === 'pending'
  const [open, setOpen] = useState(defaultExpanded)
  const label = collapsedLabel(proposal, status)
  const Icon = proposal.kind === 'highlight' ? Highlighter : Bookmark

  if (embedded && !pending) {
    return (
      <p className="text-[10px] text-muted-foreground">{label}</p>
    )
  }

  return (
    <AgentChatItem
      variant="card"
      tone={pending ? 'tool-pending' : 'tool'}
      streaming={false}
      probe="mark-proposal"
      messageId={proposal.id}
      role="mark-proposal"
      className={cn(embedded ? 'mt-2' : undefined, className)}
    >
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 px-2.5 py-1.5 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <Icon
          className={cn(
            'size-3.5 shrink-0',
            proposal.kind === 'highlight'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-primary',
          )}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/90">
          {label}
        </span>
        {pending ? (
          <span className="shrink-0 text-[10px] text-amber-700 dark:text-amber-400">
            展开确认
          </span>
        ) : null}
      </button>

      {open ? (
        <AgentChatItemBody className="border-border/30">
          <ProposeMarkCard
            proposal={proposal}
            status={status}
            compact
            hideHeader
            className="mt-0 border-0 bg-transparent p-0"
            onNoteChange={onNoteChange}
            onAdopt={onAdopt}
            onDismiss={onDismiss}
            onResolved={onResolved}
            extraActions={extraActions}
          />
        </AgentChatItemBody>
      ) : null}
    </AgentChatItem>
  )
}

interface ProposeMarkBlockListProps {
  proposals: Array<{
    proposal: ProposedMark
    status: MarkProposalStatus
  }>
  defaultExpanded?: boolean
  embedded?: boolean
  onResolved?: (proposalId: string, status: Exclude<MarkProposalStatus, 'pending'>) => void
  onNoteChange?: (proposalId: string, note: string) => void
  onAdopt?: (proposalId: string, note: string) => void | Promise<void>
  onDismiss?: (proposalId: string) => void
  extraActionsFor?: (proposalId: string) => ReactNode
}

/** 同一条 Agent 回复下多条提议（P3 批量复用）。 */
export function ProposeMarkBlockList({
  proposals,
  defaultExpanded = false,
  embedded = false,
  onResolved,
  onNoteChange,
  onAdopt,
  onDismiss,
  extraActionsFor,
}: ProposeMarkBlockListProps) {
  if (proposals.length === 0) return null

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', embedded ? 'mt-2' : undefined)}>
      {proposals.map((row) => (
        <ProposeMarkChatBlock
          key={row.proposal.id}
          proposal={row.proposal}
          status={row.status}
          defaultExpanded={defaultExpanded}
          embedded={embedded}
          onNoteChange={
            onNoteChange ? (note) => onNoteChange(row.proposal.id, note) : undefined
          }
          onAdopt={onAdopt ? (note) => onAdopt(row.proposal.id, note) : undefined}
          onDismiss={onDismiss ? () => onDismiss(row.proposal.id) : undefined}
          onResolved={
            onResolved ? (status) => onResolved(row.proposal.id, status) : undefined
          }
          extraActions={extraActionsFor?.(row.proposal.id)}
        />
      ))}
    </div>
  )
}
