import { useEffect, useMemo, useState } from 'react'
import { Bookmark, ChevronDown, ChevronRight, Download, Highlighter, MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ReadingMark } from '@shared/types/reading-mark'
import {
  groupMarksByChapter,
  type ReadingNotesChapterRef,
  type ReadingNotesContentKind,
  type ReadingNotesScope,
} from '@/lib/reader/export-reading-notes'
import {
  getReadingMarkDisplayKind,
  getReadingMarkLabel,
  getReadingMarkStatusLabel,
} from '@/lib/reader/reading-mark-labels'
import { highlightSwatch } from '@/lib/reader/reading-mark-colors'
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

const CONTENT_KIND_ITEMS: Array<{ kind: ReadingNotesContentKind; label: string }> = [
  { kind: 'notes', label: '批注' },
  { kind: 'highlights', label: '重点' },
  { kind: 'combined', label: '综合' },
]

const SCOPE_ITEMS: Array<{ scope: ReadingNotesScope; label: string }> = [
  { scope: 'chapter', label: '本章' },
  { scope: 'book', label: '全书' },
]

function MarkListItem({
  mark,
  onSelect,
  onDelete,
}: {
  mark: ReadingMark
  onSelect: (mark: ReadingMark) => void
  onDelete: (mark: ReadingMark) => void
}) {
  const displayKind = getReadingMarkDisplayKind(mark)
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-accent/40"
        onClick={() => onSelect(mark)}
      >
        <MarkKindIcon kind={displayKind} />
        {displayKind !== 'bookmark' ? (
          <span
            className="mt-0.5 size-2 shrink-0 rounded-full ring-1 ring-black/20 dark:ring-white/30"
            style={{ backgroundColor: highlightSwatch(mark.color) }}
            aria-hidden
          />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{getReadingMarkLabel(mark)}</span>
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            {getReadingMarkStatusLabel(mark)}
          </span>
          {mark.note?.trim() ? (
            <span className={cn('mt-1 block line-clamp-2 text-[11px] text-muted-foreground')}>
              {mark.note.trim()}
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
  )
}

interface ReadingMarkPanelProps {
  marks: ReadingMark[]
  onSelect: (mark: ReadingMark) => void
  onDelete: (mark: ReadingMark) => void
  onClose: () => void
  onExportNotes?: (contentKind: ReadingNotesContentKind, scope: ReadingNotesScope) => void
  /** 按目录分组；不传则扁平列表 */
  marksToc?: ReadingNotesChapterRef[]
  currentChapterKey?: string
  resolveChapter?: (mark: ReadingMark, toc: ReadingNotesChapterRef[]) => ReadingNotesChapterRef
}

export function ReadingMarkPanel({
  marks,
  onSelect,
  onDelete,
  onClose,
  onExportNotes,
  marksToc,
  currentChapterKey,
  resolveChapter,
}: ReadingMarkPanelProps) {
  const chapters = useMemo(() => {
    if (!marksToc || !resolveChapter || marks.length === 0) return null
    return groupMarksByChapter({ marks, toc: marksToc, resolveChapter })
  }, [marks, marksToc, resolveChapter])

  const [openKeys, setOpenKeys] = useState<Set<string>>(() =>
    currentChapterKey ? new Set([currentChapterKey]) : new Set(),
  )

  useEffect(() => {
    if (currentChapterKey) {
      setOpenKeys(new Set([currentChapterKey]))
    }
  }, [currentChapterKey])

  useEffect(() => {
    if (currentChapterKey) return
    const first = chapters?.[0]?.key
    if (!first) return
    setOpenKeys((prev) => (prev.size === 0 ? new Set([first]) : prev))
  }, [chapters, currentChapterKey])

  const toggleChapter = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <aside className="flex w-[min(28%,320px)] min-w-[180px] shrink-0 flex-col border-r border-border/60">
      <div className="flex items-center justify-between gap-1 border-b border-border/60 px-3 py-2">
        <span className="text-xs font-medium text-foreground">书签与批注</span>
        <div className="flex items-center gap-0.5">
          {onExportNotes ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                  <Download className="size-3.5" />
                  导出
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                  导出笔记为 Markdown
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SCOPE_ITEMS.map((scopeItem) => (
                  <DropdownMenuSub key={scopeItem.scope}>
                    <DropdownMenuSubTrigger className="text-xs">{scopeItem.label}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-36">
                      {CONTENT_KIND_ITEMS.map((contentItem) => (
                        <DropdownMenuItem
                          key={contentItem.kind}
                          className="text-xs"
                          onClick={() => onExportNotes(contentItem.kind, scopeItem.scope)}
                        >
                          {contentItem.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {marks.length === 0 ? (
          <p className="px-3 py-6 text-xs text-muted-foreground">暂无书签或批注</p>
        ) : chapters && chapters.length > 0 ? (
          <div className="py-1">
            {chapters.map((chapter) => {
              const open = openKeys.has(chapter.key)
              const isCurrent = Boolean(currentChapterKey && chapter.key === currentChapterKey)
              return (
                <div key={chapter.key} className="border-b border-border/40 last:border-b-0">
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-1 px-2 py-1.5 text-left hover:bg-accent/30',
                      isCurrent && 'bg-accent/20',
                    )}
                    onClick={() => toggleChapter(chapter.key)}
                    aria-expanded={open}
                  >
                    {open ? (
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                      {chapter.label}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{chapter.marks.length}</span>
                  </button>
                  {open ? (
                    <ul className="divide-y divide-border/40 border-t border-border/30">
                      {chapter.marks.map((mark) => (
                        <MarkListItem
                          key={mark.id}
                          mark={mark}
                          onSelect={onSelect}
                          onDelete={onDelete}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {marks.map((mark) => (
              <MarkListItem key={mark.id} mark={mark} onSelect={onSelect} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  )
}
