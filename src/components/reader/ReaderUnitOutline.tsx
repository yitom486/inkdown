import { ChevronDown, ChevronRight, ListTree } from 'lucide-react'
import type { ReaderUnit } from '@/lib/reader-navigation'
import { cn } from '@/lib/utils'

interface ReaderUnitOutlineProps {
  units: ReaderUnit[]
  currentUnitId?: string
  collapsed?: boolean
  onToggle: () => void
  onSelectUnit: (unit: ReaderUnit) => void
}

export function ReaderUnitOutline({
  units,
  currentUnitId,
  collapsed = false,
  onToggle,
  onSelectUnit,
}: ReaderUnitOutlineProps) {
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
        {units.length > 0 && (
          <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground/80">
            {units.length}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-auto">
          {units.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">暂无目录</p>
          ) : (
            <ul className="space-y-0.5 p-2">
              {units.map((item) => (
                <li key={`${item.href}-${item.label}-${item.level}`}>
                  <button
                    type="button"
                    className={cn(
                      'w-full truncate rounded-md py-1 pr-2 text-left text-xs transition-colors hover:bg-accent/50 hover:text-foreground',
                      currentUnitId === item.href
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground',
                    )}
                    style={{ paddingLeft: `${item.level * 10 + 8}px` }}
                    title={item.label}
                    onClick={() => onSelectUnit(item)}
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
