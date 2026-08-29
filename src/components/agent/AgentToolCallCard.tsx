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
import type { ReactNode } from 'react'
import {
  AgentChatItem,
  AgentChatItemBody,
  AGENT_CHAT_PRE_CLASS,
  useAgentChatOpen,
} from '@/components/agent/AgentChatItem'
import { AgentDiffPreview } from '@/components/agent/AgentDiffPreview'
import { AgentPermissionCard } from '@/components/agent/AgentPermissionCard'
import { toolMessageNeedsApproval } from '@/lib/acp-permission-ui'
import type { AcpChatMessage } from '@/stores/acp-chat-types'
import { isToolActiveStatus } from '@/stores/acp-chat-types'
import { useAcpPendingPermission } from '@/stores/acp-ui-store'

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
  const pendingPermission = useAcpPendingPermission()
  const needsApproval = toolMessageNeedsApproval(message, pendingPermission)
  const active =
    Boolean(message.streaming) || isToolActiveStatus(message.toolStatus) || needsApproval
  const [open, setOpen] = useAgentChatOpen(active)
  const diffs = message.toolDiffs ?? []
  const detail = message.toolContentText || message.text
  const hasTextDetail = Boolean(detail && detail !== message.toolTitle && diffs.length === 0)
  const locations = message.toolLocations ?? []
  const hasBody = hasTextDetail || diffs.length > 0 || locations.length > 0 || needsApproval

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
    <AgentChatItem
      variant="card"
      tone={needsApproval ? 'tool-pending' : 'tool'}
      streaming={active}
      probe="tool"
      messageId={message.id}
      role="tool"
    >
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 px-2.5 py-1.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {statusIcon(message.toolStatus, message.streaming || needsApproval)}
        <span className="text-muted-foreground">{kindIcon(message.toolKind)}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/90">
          {title}
          {locationHint ? (
            <span className="ml-1.5 font-normal text-muted-foreground">{locationHint}</span>
          ) : null}
          {needsApproval ? (
            <span className="ml-1.5 font-normal text-amber-700 dark:text-amber-400">
              · 待批准
            </span>
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
        <AgentChatItemBody>
          {locations.length > 0 && diffs.length === 0 ? (
            <ul className="min-w-0 space-y-0.5">
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
          {hasTextDetail ? <pre className={AGENT_CHAT_PRE_CLASS}>{detail}</pre> : null}
          {needsApproval && pendingPermission ? (
            <AgentPermissionCard pending={pendingPermission} compact />
          ) : null}
        </AgentChatItemBody>
      ) : null}
    </AgentChatItem>
  )
}
