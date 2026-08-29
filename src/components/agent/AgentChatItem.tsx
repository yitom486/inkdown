import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { logAcpLayoutProbe } from '@/lib/acp-layout-probe'
import { cn } from '@/lib/utils'

/**
 * 聊天条目统一壳：宽度 / 换行 / 对齐只在这里定义。
 * 流式与终态共用同一 DOM 壳；内容插槽可换，壳不换。
 *
 * 仅本面板用的 UI 状态（折叠等）用 useAgentChatOpen，不要进 Zustand。
 * Zustand 只放会话消息、连接、权限等跨层数据。
 */

export type AgentChatItemVariant = 'bubble' | 'card' | 'system'

export type AgentChatItemTone =
  | 'default'
  | 'user'
  | 'agent'
  | 'tool'
  | 'tool-pending'
  | 'thought'
  | 'plan'
  | 'activity'
  | 'activity-active'

/** 列表列宽约束：ScrollArea 内所有条目祖先应带上 */
export const AGENT_CHAT_COL_CLASS =
  'min-w-0 max-w-full overflow-x-hidden'

/** 可折叠区块正文：长路径 / pre 不得撑开列 */
export const AGENT_CHAT_BODY_CLASS =
  'min-w-0 max-w-full space-y-1.5 overflow-x-hidden border-t border-border/40 px-2.5 py-2'

/** 长文本 / 工具输出 */
export const AGENT_CHAT_PRE_CLASS =
  'max-h-40 max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]'

interface AgentChatItemProps {
  variant: AgentChatItemVariant
  tone?: AgentChatItemTone
  /** bubble：用户靠右，其余靠左；card/system 忽略 */
  align?: 'start' | 'end'
  streaming?: boolean
  probe?: string
  messageId?: string
  role?: string
  className?: string
  children: ReactNode
}

function cardToneClass(tone: AgentChatItemTone): string {
  switch (tone) {
    case 'tool':
      return 'border-border/50 bg-muted/15'
    case 'tool-pending':
      return 'border-amber-500/45 bg-amber-500/[0.07]'
    case 'thought':
      return 'border-border/40 bg-muted/10'
    case 'plan':
      return 'border-border/50 bg-muted/10'
    case 'activity':
      return 'border-border/40 bg-muted/10'
    case 'activity-active':
      return 'border-amber-500/20 bg-amber-500/[0.04]'
    default:
      return 'border-border/50 bg-muted/15'
  }
}

function cardActiveRing(tone: AgentChatItemTone, streaming?: boolean): string | false {
  if (!streaming) return false
  if (tone === 'tool-pending' || tone === 'activity-active') return false
  if (tone === 'tool') return 'border-amber-500/25 bg-amber-500/5'
  if (tone === 'plan') return 'border-sky-500/25 bg-sky-500/5'
  if (tone === 'activity') return 'border-amber-500/20 bg-amber-500/[0.04]'
  return false
}

function useLayoutProbe(
  rootRef: RefObject<HTMLDivElement | null>,
  meta: {
    probe?: string
    messageId?: string
    role?: string
    streaming?: boolean
  },
) {
  const prevStreaming = useRef(meta.streaming)
  useEffect(() => {
    const flipped = prevStreaming.current !== meta.streaming
    prevStreaming.current = meta.streaming
    const id = window.requestAnimationFrame(() => {
      logAcpLayoutProbe(rootRef.current, {
        tag: 'AgentChatItem',
        role: meta.role ?? meta.probe,
        messageId: meta.messageId,
        streaming: Boolean(meta.streaming),
        force: flipped,
      })
    })
    return () => window.cancelAnimationFrame(id)
  }, [rootRef, meta.messageId, meta.probe, meta.role, meta.streaming])
}

/**
 * 跟随 active 的折叠状态（仅聊天框本地 UI，不进 store）。
 * active 变 true 时强制展开；变 false 时收起（用户仍可手动点开）。
 */
export function useAgentChatOpen(active: boolean) {
  const [open, setOpen] = useState(active)
  useEffect(() => {
    setOpen(active)
  }, [active])
  return [open, setOpen] as const
}

export function AgentChatItemBody({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn(AGENT_CHAT_BODY_CLASS, className)}>{children}</div>
}

export function AgentChatItem({
  variant,
  tone = 'default',
  align = 'start',
  streaming,
  probe,
  messageId,
  role,
  className,
  children,
}: AgentChatItemProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  useLayoutProbe(rootRef, { probe, messageId, role, streaming })

  if (variant === 'system') {
    return (
      <div
        ref={rootRef}
        data-acp-probe={probe ?? 'system'}
        className={cn(
          AGENT_CHAT_COL_CLASS,
          'px-1 py-0.5 text-center text-[10px] text-muted-foreground/70',
          className,
        )}
      >
        {children}
      </div>
    )
  }

  if (variant === 'bubble') {
    const isUser = tone === 'user'
    return (
      <div
        ref={rootRef}
        data-acp-probe={probe ?? (isUser ? 'user' : 'agent')}
        className={cn(
          'group flex flex-col gap-1',
          AGENT_CHAT_COL_CLASS,
          align === 'end' || isUser ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'min-w-0 max-w-[95%] overflow-x-hidden rounded-2xl px-3 py-2 text-[12px] leading-relaxed shadow-sm',
            isUser
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'w-full rounded-bl-md border border-border/60 bg-card text-card-foreground',
            streaming && !isUser && 'ring-1 ring-emerald-500/20',
            className,
          )}
        >
          {children}
        </div>
      </div>
    )
  }

  // card：工具 / 思考 / 计划 / 活动组
  return (
    <div
      ref={rootRef}
      data-acp-probe={probe ?? tone}
      className={cn(
        AGENT_CHAT_COL_CLASS,
        'rounded-xl border transition-colors',
        cardToneClass(tone),
        cardActiveRing(tone, streaming),
        className,
      )}
    >
      {children}
    </div>
  )
}
