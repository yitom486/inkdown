import { useState } from 'react'
import { SUPPORTED_WORKSPACE_EXTENSION_LABEL } from '@shared/constants'
import { ChevronDown, ChevronRight, BookOpen, FileText, Folder, FolderOpen, RefreshCw } from 'lucide-react'
import type { FileTreeNode } from '@shared/file-types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileExplorerProps {
  workspaceRoot?: string
  tree: FileTreeNode[]
  activeFilePath?: string
  onOpenFolder: () => void
  onRescanWorkspace?: () => void
  isRescanning?: boolean
  onSelectFile: (path: string) => void
}

function FileIcon({ documentKind }: { documentKind?: FileTreeNode['documentKind'] }) {
  if (documentKind === 'pdf' || documentKind === 'epub') {
    return <BookOpen className="size-3.5 shrink-0 text-sky-500/90" />
  }
  return <FileText className="size-3.5 shrink-0" />
}

function TreeNode({
  node,
  depth,
  activeFilePath,
  onSelectFile,
}: {
  node: FileTreeNode
  depth: number
  activeFilePath?: string
  onSelectFile: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isDirectory = node.type === 'directory'
  const isActive = node.path === activeFilePath

  if (isDirectory) {
    return (
      <div>
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0 opacity-70" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 opacity-70" />
          )}
          <Folder className="size-3.5 shrink-0 text-amber-500/90" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFilePath={activeFilePath}
              onSelectFile={onSelectFile}
            />
          ))}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors',
        isActive
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
      onClick={() => onSelectFile(node.path)}
    >
      <FileIcon documentKind={node.documentKind} />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export function FileExplorer({
  workspaceRoot,
  tree,
  activeFilePath,
  onOpenFolder,
  onRescanWorkspace,
  isRescanning = false,
  onSelectFile,
}: FileExplorerProps) {
  const rootName = workspaceRoot?.split(/[/\\]/).pop() ?? '工作区'

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FolderOpen className="size-3.5" />
          资源管理器
        </div>
        <div className="flex items-center gap-1">
          {workspaceRoot && onRescanWorkspace ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              disabled={isRescanning}
              onClick={onRescanWorkspace}
              title="重新扫描工作区"
            >
              <RefreshCw className={`size-3.5 ${isRescanning ? 'animate-spin' : ''}`} />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={onOpenFolder}
          >
            打开
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!workspaceRoot ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <FolderOpen className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">打开文件夹以浏览 Markdown 与电子书</p>
            <Button size="sm" onClick={onOpenFolder}>
              打开文件夹
            </Button>
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            <div className="mb-2 truncate px-2 text-xs font-medium text-foreground/80">
              {rootName}
            </div>
            {tree.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                此文件夹中没有支持的文档
                <br />
                <span className="text-[11px] opacity-80">
                  支持：{SUPPORTED_WORKSPACE_EXTENSION_LABEL}
                </span>
              </p>
            ) : (
              tree.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  activeFilePath={activeFilePath}
                  onSelectFile={onSelectFile}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
