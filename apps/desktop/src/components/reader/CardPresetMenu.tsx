import { useState } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CARD_STUDIO_PRESETS,
  type CardStudioPresetId,
} from '@/lib/agent/card-studio-presets'

/**
 * AI 制卡预设菜单内容（P1，选择即制卡）。
 * 选择发生在按钮上：6 预设点即生成；自定义收进末项（次级，点开才见输入框）。
 * 样式中性（普通按钮行），SelectionToolbar 与 SelectionBubble 共用，
 * 各自负责外层定位容器（与气泡既有 color-picker popover 同构）。
 */
export function CardPresetMenuContent({
  onPick,
  pending,
  className,
}: {
  onPick: (presetId: CardStudioPresetId, customText?: string) => void
  pending: boolean
  className?: string
}) {
  const [customOpen, setCustomOpen] = useState(false)
  const [customText, setCustomText] = useState('')

  return (
    <div
      role="menu"
      aria-label="AI 制卡方向"
      className={cn(
        'min-w-[188px] rounded-xl border border-border/80 bg-card/95 p-1 text-card-foreground shadow-2xl backdrop-blur-xl',
        className,
      )}
    >
      {CARD_STUDIO_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="menuitem"
          disabled={pending}
          onClick={() => onPick(preset.id)}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="size-3.5 shrink-0 text-primary" />
          <span className="font-medium">{preset.label}</span>
        </button>
      ))}
      <div className="mx-1 my-1 h-px bg-border/60" />
      {!customOpen ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setCustomOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50 cursor-pointer"
        >
          <span className="flex size-3.5 items-center justify-center font-bold">…</span>
          <span>更多要求</span>
        </button>
      ) : (
        <div className="space-y-1.5 p-1">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !pending) {
                onPick('distill', customText)
              }
            }}
            placeholder="补充一句要求（冲突以它为准）"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => onPick('distill', customText)}
            className="flex w-full items-center justify-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50 cursor-pointer"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            <span>{pending ? '生成中…' : '通用提炼并生成'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
