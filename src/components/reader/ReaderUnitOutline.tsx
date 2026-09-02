import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ListTree, Pencil } from 'lucide-react'
import type { ReaderUnit } from '@/lib/reader/reader-navigation'
import {
  buildReaderUnitTree,
  shouldExpandReaderUnitNode,
  type ReaderUnitTreeNode,
} from '@/lib/reader/reader-unit-tree'
import { cn } from '@/lib/utils'

interface ReaderUnitOutlineProps {
  units: ReaderUnit[]
  currentUnitId?: string
  collapsed?: boolean
  onToggle: () => void
  onSelectUnit: (unit: ReaderUnit) => void
  onEditToc?: () => void
}

function OutlineTreeNode({
  node,
  depth,
  currentUnitId,
  onSelectUnit,
}: {
  node: ReaderUnitTreeNode
  depth: number
  currentUnitId?: string
  onSelectUnit: (unit: ReaderUnit) => void
}) {
  const hasChildren = node.children.length > 0
  const [expanded, setExpanded] = useState(() => shouldExpandReaderUnitNode(depth))
  const isActive = currentUnitId === node.unit.href

  return (
    <li>
      <div className="flex items-center gap-0.5">
        {hasChildren ? (
          <button
            type="button"
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            aria-label={expanded ? '折叠' : '展开'}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <button
          type="button"
          className={cn(
            'min-w-0 flex-1 truncate rounded-md py-1 pr-2 text-left text-xs transition-colors hover:bg-accent/50 hover:text-foreground',
            isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground',
          )}
          style={{ paddingLeft: `${depth * 10 + 4}px` }}
          title={node.unit.label}
          onClick={() => onSelectUnit(node.unit)}
        >
          {node.unit.label}
        </button>
      </div>
      {hasChildren && expanded ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <OutlineTreeNode
              key={`${child.unit.href}-${child.unit.label}-${child.unit.level}`}
              node={child}
              depth={depth + 1}
              currentUnitId={currentUnitId}
              onSelectUnit={onSelectUnit}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function ReaderUnitOutline({
  units,
  currentUnitId,
  collapsed = false,
  onToggle,
  onSelectUnit,
  onEditToc,
}: ReaderUnitOutlineProps) {
  const tree = useMemo(() => buildReaderUnitTree(units), [units])

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
          <span className="ml-auto flex items-center gap-1 text-[10px] font-normal normal-case text-muted-foreground/80">
            {onEditToc ? (
              <button
                type="button"
                className="rounded p-0.5 hover:bg-accent/50 hover:text-foreground"
                aria-label="校正目录"
                title="校正目录"
                onClick={(event) => {
                  event.stopPropagation()
                  onEditToc()
                }}
              >
                <Pencil className="size-3" />
              </button>
            ) : null}
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
              {tree.map((node) => (
                <OutlineTreeNode
                  key={`${node.unit.href}-${node.unit.label}-${node.unit.level}`}
                  node={node}
                  depth={0}
                  currentUnitId={currentUnitId}
                  onSelectUnit={onSelectUnit}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
