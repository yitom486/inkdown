import { useEffect } from 'react'
import { BotMessageSquare, ClipboardPaste, Copy, Highlighter, MessageSquarePlus, Quote } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface SelectionToolbarProps {
  x: number
  y: number
  readOnly?: boolean
  onCopy: () => void
  onAnnotate: () => void
  /** 打开 Agent 面板并带着当前选区去提问 */
  onAskAgent?: () => void
  /** 在输入框插入「选区」短标记（不贴正文） */
  onAddToChat?: () => void
  /** 将当前选区存为高亮，不打开批注对话框 */
  onHighlight?: () => void
  onDismiss: () => void
}

export function SelectionToolbar({
  x,
  y,
  readOnly = true,
  onCopy,
  onAnnotate,
  onAskAgent,
  onAddToChat,
  onHighlight,
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
      {readOnly ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => undefined}
        >
          <ClipboardPaste className="size-3.5" />
          粘贴
        </Button>
      )}
      {onHighlight ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onHighlight}
        >
          <Highlighter className="size-3.5" />
          划重点
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
      {onAddToChat ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          title="在输入框插入「选区」标记，正文由 Agent 读取"
          onClick={onAddToChat}
        >
          <Quote className="size-3.5" />
          加入对话
        </Button>
      ) : null}
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
    </div>
  )
}
