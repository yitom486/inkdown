import { Copy, ClipboardPaste, MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SelectionToolbarProps {
  x: number
  y: number
  readOnly?: boolean
  onCopy: () => void
  onAnnotate: () => void
  onDismiss: () => void
}

export function SelectionToolbar({
  x,
  y,
  readOnly = true,
  onCopy,
  onAnnotate,
  onDismiss,
}: SelectionToolbarProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onDismiss} aria-hidden />
      <div
        className="fixed z-50 flex items-center gap-0.5 rounded-md border border-border/80 bg-popover p-1 shadow-md"
        style={{ left: x, top: Math.max(8, y - 44) }}
        role="toolbar"
        aria-label="选区操作"
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
    </>
  )
}
