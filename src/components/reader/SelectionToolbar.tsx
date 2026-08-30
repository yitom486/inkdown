import { useEffect } from 'react'
import { BotMessageSquare, ClipboardPaste, Copy, MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SelectionToolbarProps {
  x: number
  y: number
  readOnly?: boolean
  onCopy: () => void
  onAnnotate: () => void
  /** 打开 Agent 面板并带着当前选区去提问 */
  onAskAgent?: () => void
  onDismiss: () => void
}

export function SelectionToolbar({
  x,
  y,
  readOnly = true,
  onCopy,
  onAnnotate,
  onAskAgent,
  onDismiss,
}: SelectionToolbarProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return (
    <div
      className="fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border/80 bg-popover p-1 shadow-md"
      style={{ left: x, top: Math.max(8, y - 48) }}
      role="toolbar"
      aria-label="选区操作"
      // 避免点工具栏时失焦导致选区被清掉、复制拿不到文本
      onMouseDown={(event) => event.preventDefault()}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={onCopy}
      >
        <Copy className="size-3.5" />
        复制
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-7 gap-1 px-2 text-xs', readOnly && 'opacity-40')}
        disabled={readOnly}
        title={readOnly ? '阅读模式下不可粘贴' : undefined}
        onClick={() => undefined}
      >
        <ClipboardPaste className="size-3.5" />
        粘贴
      </Button>
      {onAskAgent ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onAskAgent}
        >
          <BotMessageSquare className="size-3.5" />
          问 Agent
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={onAnnotate}
      >
        <MessageSquarePlus className="size-3.5" />
        批注
      </Button>
    </div>
  )
}
