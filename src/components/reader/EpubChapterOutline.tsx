import { ChevronDown, ChevronRight, ListTree } from 'lucide-react'
import type { EpubChapter } from '@/lib/epub-navigation'
import { cn } from '@/lib/utils'

interface EpubChapterOutlineProps {
  chapters: EpubChapter[]
  currentHref?: string
  collapsed?: boolean
  onToggle: () => void
  onSelectChapter: (chapter: EpubChapter) => void
}

export function EpubChapterOutline({
  chapters,
  currentHref,
  collapsed = false,
  onToggle,
  onSelectChapter,
}: EpubChapterOutlineProps) {
  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden bg-sidebar',
        collapsed && 'shrink-0 border-r border-border/60',
      )}
    >
      <button
        type="button"
        className="flex w-full shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/30 hover:text-foreground"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className="size-3.5 shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0" />
        )}
        <ListTree className="size-3.5 shrink-0" />
        目录
        {chapters.length > 0 && (
          <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground/80">
            {chapters.length}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-auto">
          {chapters.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">暂无章节目录</p>
          ) : (
            <ul className="space-y-0.5 p-2">
              {chapters.map((item) => (
                <li key={`${item.href}-${item.label}-${item.level}`}>
                  <button
                    type="button"
                    className={cn(
                      'w-full truncate rounded-md py-1 pr-2 text-left text-xs transition-colors hover:bg-accent/50 hover:text-foreground',
                      currentHref === item.href
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground',
                    )}
                    style={{ paddingLeft: `${item.level * 10 + 8}px` }}
                    title={item.label}
                    onClick={() => onSelectChapter(item)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
