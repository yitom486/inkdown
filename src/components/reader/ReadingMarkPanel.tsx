import { Bookmark, Highlighter, MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ReadingMark } from '@shared/types/reading-mark'
import { getReadingMarkKindLabel, getReadingMarkLabel } from '@/lib/reading-mark-labels'
import { highlightSwatch } from '@/lib/reading-mark-colors'
import { cn } from '@/lib/utils'

function MarkKindIcon({ kind }: { kind: ReadingMark['kind'] }) {
  switch (kind) {
    case 'bookmark':
      return <Bookmark className="size-3.5 shrink-0" />
    case 'highlight':
      return <Highlighter className="size-3.5 shrink-0" />
    case 'note':
      return <MessageSquare className="size-3.5 shrink-0" />
  }
}

interface ReadingMarkPanelProps {
  marks: ReadingMark[]
  onSelect: (mark: ReadingMark) => void
  onDelete: (mark: ReadingMark) => void
  onClose: () => void
}

export function ReadingMarkPanel({ marks, onSelect, onDelete, onClose }: ReadingMarkPanelProps) {
  return (
    <aside className="flex w-[min(28%,320px)] min-w-[180px] shrink-0 flex-col border-r border-border/60">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="text-xs font-medium text-foreground">书签与批注</span>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
          关闭
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {marks.length === 0 ? (
          <p className="px-3 py-6 text-xs text-muted-foreground">暂无书签或批注</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {marks.map((mark) => (
              <li key={mark.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-accent/40"
                  onClick={() => onSelect(mark)}
                >
                  <MarkKindIcon kind={mark.kind} />
                  {mark.kind === 'highlight' ? (
                    <span
                      className="mt-0.5 size-2 shrink-0 rounded-full ring-1 ring-black/20 dark:ring-white/30"
                      style={{ backgroundColor: highlightSwatch(mark.color) }}
                      aria-hidden
                    />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{getReadingMarkLabel(mark)}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {getReadingMarkKindLabel(mark.kind)}
                      {mark.note ? ' · 含笔记' : ''}
                    </span>
                    {mark.note ? (
                      <span className={cn('mt-1 block line-clamp-2 text-[11px] text-muted-foreground')}>
                        {mark.note}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="删除"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(mark)
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  )
}
