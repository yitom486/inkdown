import { Loader2, MessageSquarePlus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEEP_ANSWER_DIRECTIONS,
  type DeepAnswerDirectionId,
} from '@/lib/agent/deep-answer'

/**
 * 一键深度问答菜单内容（P2）：三方向点即直答，答案落对话框；
 * 末项保留 composer 追问入口（交互式不动）。
 * 与 CardPresetMenu 同构，SelectionToolbar 专用（气泡沿用 composer 草稿）。
 */
export function DeepAnswerMenuContent({
  onPick,
  onOpenComposer,
  pending,
  className,
}: {
  onPick: (directionId: DeepAnswerDirectionId) => void
  onOpenComposer: () => void
  pending: boolean
  className?: string
}) {
  return (
    <div
      role="menu"
      aria-label="深度问答方向"
      className={cn(
        'min-w-[188px] rounded-xl border border-border/80 bg-card/95 p-1 text-card-foreground shadow-2xl backdrop-blur-xl',
        className,
      )}
    >
      {DEEP_ANSWER_DIRECTIONS.map((direction) => (
        <button
          key={direction.id}
          type="button"
          role="menuitem"
          disabled={pending}
          onClick={() => onPick(direction.id)}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted disabled:opacity-50 cursor-pointer"
        >
          {pending ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
          ) : (
            <Sparkles className="size-3.5 shrink-0 text-primary" />
          )}
          <span className="font-medium">{direction.label}</span>
        </button>
      ))}
      <div className="mx-1 my-1 h-px bg-border/60" />
      <button
        type="button"
        onClick={onOpenComposer}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
      >
        <MessageSquarePlus className="size-3.5 shrink-0" />
        <span>去 Agent 面板细问</span>
      </button>
    </div>
  )
}
