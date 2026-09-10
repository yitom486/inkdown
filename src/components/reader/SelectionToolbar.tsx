import { useEffect } from 'react'
import { BotMessageSquare, ClipboardPaste, Copy, MessageSquarePlus, Quote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isMarkdownEditorFocused } from '@/lib/editor/editor-focus'
import { shouldHandleReaderCopyShortcut } from '@/lib/reader/reader-copy-shortcut'
import {
  HIGHLIGHT_COLORS,
  type HighlightColorId,
} from '@/lib/reader/reading-mark-colors'

export interface SelectionToolbarProps {
  x: number
  y: number
  readOnly?: boolean
  onCopy: () => void
  /** 快捷键复制门：无阅读选区时不拦截（Electron editMenu 保底） */
  hasSelectionForCopy?: boolean
  /** iframe 阅读器（Foliate/WebDoc）额外监听其 contentDocument，PDF 不传 */
  keyEventDocs?: Document[]
  onAnnotate: () => void
  /** 打开 Agent 面板并带着当前选区去提问 */
  onAskAgent?: () => void
  /** 在输入框插入「选区」短标记（不贴正文） */
  onAddToChat?: () => void
  /** 将当前选区存为高亮；颜色由色点选择，默认黄 */
  onHighlight?: (color: HighlightColorId) => void
  onDismiss: () => void
}

export function SelectionToolbar({
  x,
  y,
  readOnly = true,
  onCopy,
  hasSelectionForCopy = false,
  keyEventDocs,
  onAnnotate,
  onAskAgent,
  onAddToChat,
  onHighlight,
  onDismiss,
}: SelectionToolbarProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss()
        return
      }
      // Markdown 编辑器内划词走原生复制，不抢
      if (isMarkdownEditorFocused()) return
      if (shouldHandleReaderCopyShortcut(event, event.target, hasSelectionForCopy)) {
        // 对齐系统 Ctrl+C：复制后保留选区与工具条，不清
        event.preventDefault()
        onCopy()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    // iframe 内按键冒泡不到主窗口：Foliate/WebDoc 把同一监听挂到内容文档
    const docs = [...new Set((keyEventDocs ?? []).filter((doc) => doc && doc !== document))]
    for (const doc of docs) doc.addEventListener('keydown', onKeyDown as EventListener)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      for (const doc of docs) doc.removeEventListener('keydown', onKeyDown as EventListener)
    }
  }, [onDismiss, onCopy, hasSelectionForCopy, keyEventDocs])

  return (
    <div
      className="fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border/80 bg-popover p-1 shadow-md"
      style={{ left: x, top: Math.max(8, y - 48) }}
      role="toolbar"
      aria-label="选区操作"
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
        <div
          className="mx-0.5 flex items-center gap-1 border-l border-border/70 pl-1.5 pr-1"
          role="group"
          aria-label="划重点"
        >
          <span className="text-[10px] text-muted-foreground">划重点</span>
          {HIGHLIGHT_COLORS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="size-3.5 rounded-full ring-1 ring-black/25 dark:ring-white/30"
              style={{ backgroundColor: item.swatch }}
              title={`划重点 · ${item.label}`}
              aria-label={`划重点 ${item.label}`}
              onClick={() => onHighlight(item.id)}
            />
          ))}
        </div>
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
