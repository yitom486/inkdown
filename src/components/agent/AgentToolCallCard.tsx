import {
  Check,
  ChevronDown,
  ChevronRight,
  FilePenLine,
  FileText,
  FolderInput,
  Globe,
  Loader2,
  Search,
  Sparkles,
  Terminal,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { AgentDiffPreview } from '@/components/agent/AgentDiffPreview'
import { cn } from '@/lib/utils'
import type { AcpChatMessage } from '@/stores/acp-chat-types'
import { isToolActiveStatus } from '@/stores/acp-chat-types'

function kindIcon(kind: string | undefined): ReactNode {
  const className = 'size-3.5 shrink-0'
  switch (kind) {
    case 'read':
      return <FileText className={className} />
    case 'edit':
      return <FilePenLine className={className} />
    case 'delete':
      return <Trash2 className={className} />
    case 'move':
      return <FolderInput className={className} />
    case 'search':
      return <Search className={className} />
    case 'execute':
      return <Terminal className={className} />
    case 'think':
      return <Sparkles className={className} />
    case 'fetch':
      return <Globe className={className} />
    default:
      return <Wrench className={className} />
  }
}

function statusIcon(status: string | undefined, streaming?: boolean): ReactNode {
  if (streaming || isToolActiveStatus(status)) {
    return <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-500" />
  }
  if (status === 'failed') {
    return <XCircle className="size-3.5 shrink-0 text-destructive" />
  }
  if (status === 'cancelled') {
    return <XCircle className="size-3.5 shrink-0 text-muted-foreground" />
  }
  return <Check className="size-3.5 shrink-0 text-emerald-500" />
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

interface AgentToolCallCardProps {
  message: AcpChatMessage
}

export function AgentToolCallCard({ message }: AgentToolCallCardProps) {
  const active = Boolean(message.streaming) || isToolActiveStatus(message.toolStatus)
  const [open, setOpen] = useState(active)
  const diffs = message.toolDiffs ?? []
  const detail = message.toolContentText || message.text
  const hasTextDetail = Boolean(detail && detail !== message.toolTitle && diffs.length === 0)
  const locations = message.toolLocations ?? []
  const hasBody = hasTextDetail || diffs.length > 0 || locations.length > 0

  useEffect(() => {
    setOpen(active)
  }, [active])

  const title = message.toolTitle || '工具调用'
  const locationHint =
    diffs.length === 1
      ? basename(diffs[0]!.path)
      : locations.length === 1
        ? basename(locations[0]!.path)
        : locations.length > 1
          ? `${locations.length} 个文件`
          : diffs.length > 1
            ? `${diffs.length} 个文件`
            : null

  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-muted/15 transition-colors',
        active && 'border-amber-500/25 bg-amber-500/5',
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {statusIcon(message.toolStatus, message.streaming)}
        <span className="text-muted-foreground">{kindIcon(message.toolKind)}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/90">
          {title}
          {locationHint ? (
            <span className="ml-1.5 font-normal text-muted-foreground">{locationHint}</span>
          ) : null}
        </span>
        {hasBody ? (
          open ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )
        ) : null}
      </button>

      {open && hasBody ? (
        <div className="space-y-1.5 border-t border-border/40 px-2.5 py-2">
          {locations.length > 0 && diffs.length === 0 ? (
            <ul className="space-y-0.5">
              {locations.map((loc) => (
                <li
                  key={`${loc.path}:${loc.line ?? ''}`}
                  className="truncate font-mono text-[10px] text-muted-foreground"
                  title={loc.path}
                >
                  {basename(loc.path)}
                  {loc.line != null ? `:${loc.line}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {diffs.length > 0 ? <AgentDiffPreview diffs={diffs} /> : null}
          {hasTextDetail ? (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-muted-foreground">
              {detail}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
