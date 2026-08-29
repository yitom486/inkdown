import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { SUPPORTED_WORKSPACE_EXTENSION_LABEL } from '@shared/constants/extensions'
import {
  BookMarked,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  RefreshCw,
  PanelLeftClose,
} from 'lucide-react'
import type { FileTreeNode } from '@shared/types/file'
import { Button } from '@/components/ui/button'
import { writeWorkspacePathsToDataTransfer } from '@/lib/acp-composer'
import { getParentDir, isMarkdownPath } from '@/lib/file-tree-ops'
import { cn } from '@/lib/utils'
import type { useFileTreeActions } from '@/hooks/useFileTreeActions'

type TreeActions = ReturnType<typeof useFileTreeActions>

interface FileExplorerProps {
  workspaceRoot?: string
  tree: FileTreeNode[]
  activeFilePath?: string
  onOpenFolder: () => void
  onRescanWorkspace?: () => void
  isRescanning?: boolean
  onSelectFile: (path: string) => void
  onHideSidebar?: () => void
  treeActions?: TreeActions
}

type MenuState =
  | {
      x: number
      y: number
      target: FileTreeNode | 'root'
    }
  | null

type InlineEdit =
  | { mode: 'rename'; path: string; value: string }
  | { mode: 'new-file' | 'new-folder'; parentDir: string; value: string }
  | null

function FileIcon({ documentKind }: { documentKind?: FileTreeNode['documentKind'] }) {
  switch (documentKind) {
    case 'pdf':
      return <FileType className="size-3.5 shrink-0 text-red-500/90" />
    case 'epub':
      return <BookOpen className="size-3.5 shrink-0 text-sky-500/90" />
    case 'mobi':
      return <BookMarked className="size-3.5 shrink-0 text-amber-500/90" />
    case 'markdown':
      return <FileText className="size-3.5 shrink-0 text-emerald-500/80" />
    default:
      return <FileText className="size-3.5 shrink-0" />
  }
}

function MenuItem({
  label,
  disabled,
  danger,
  onClick,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs outline-none',
        disabled
          ? 'cursor-not-allowed text-muted-foreground/50'
          : danger
            ? 'text-destructive hover:bg-destructive/10'
            : 'hover:bg-accent hover:text-accent-foreground',
      )}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function MenuSeparator() {
  return <div className="my-1 h-px bg-border/70" />
}

function TreeNode({
  node,
  depth,
  activeFilePath,
  onSelectFile,
  onContextMenu,
  inlineEdit,
  onInlineChange,
  onInlineCommit,
  onInlineCancel,
  forceExpandPath,
}: {
  node: FileTreeNode
  depth: number
  activeFilePath?: string
  onSelectFile: (path: string) => void
  onContextMenu: (event: ReactMouseEvent, node: FileTreeNode) => void
  inlineEdit: InlineEdit
  onInlineChange: (value: string) => void
  onInlineCommit: () => void
  onInlineCancel: () => void
  forceExpandPath?: string | null
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isDirectory = node.type === 'directory'
  const isActive = node.path === activeFilePath
  const renaming = inlineEdit?.mode === 'rename' && inlineEdit.path === node.path
  const creatingHere =
    (inlineEdit?.mode === 'new-file' || inlineEdit?.mode === 'new-folder') &&
    inlineEdit.parentDir === node.path

  useEffect(() => {
    if (forceExpandPath && (forceExpandPath === node.path || forceExpandPath.startsWith(node.path))) {
      setExpanded(true)
    }
  }, [forceExpandPath, node.path])

  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (renaming || creatingHere) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [renaming, creatingHere])

  const rowPadding = { paddingLeft: `${depth * 12 + (isDirectory ? 8 : 24)}px` }

  if (isDirectory) {
    return (
      <div>
        <div
          className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          style={rowPadding}
          onContextMenu={(e) => onContextMenu(e, node)}
        >
          <button
            type="button"
            className="inline-flex items-center gap-1 min-w-0 flex-1 text-left"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <ChevronDown className="size-3.5 shrink-0 opacity-70" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 opacity-70" />
            )}
            <Folder className="size-3.5 shrink-0 text-amber-500/90" />
            {renaming ? (
              <input
                ref={inputRef}
                className="min-w-0 flex-1 rounded border border-ring bg-background px-1 py-0.5 text-xs text-foreground outline-none"
                value={inlineEdit.value}
                onChange={(e) => onInlineChange(e.target.value)}
                onBlur={() => onInlineCommit()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onInlineCommit()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    onInlineCancel()
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </button>
        </div>
        {expanded ? (
          <div>
            {creatingHere ? (
              <div
                className="flex items-center gap-2 px-2 py-1"
                style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}
              >
                {inlineEdit.mode === 'new-folder' ? (
                  <Folder className="size-3.5 shrink-0 text-amber-500/90" />
                ) : (
                  <FileText className="size-3.5 shrink-0" />
                )}
                <input
                  ref={inputRef}
                  className="min-w-0 flex-1 rounded border border-ring bg-background px-1 py-0.5 text-xs outline-none"
                  value={inlineEdit.value}
                  onChange={(e) => onInlineChange(e.target.value)}
                  onBlur={() => onInlineCommit()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      onInlineCommit()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      onInlineCancel()
                    }
                  }}
                />
              </div>
            ) : null}
            {node.children?.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFilePath={activeFilePath}
                onSelectFile={onSelectFile}
                onContextMenu={onContextMenu}
                inlineEdit={inlineEdit}
                onInlineChange={onInlineChange}
                onInlineCommit={onInlineCommit}
                onInlineCancel={onInlineCancel}
                forceExpandPath={forceExpandPath}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'flex w-full cursor-grab items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors active:cursor-grabbing',
        isActive
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        renaming && 'cursor-default active:cursor-default',
      )}
      style={rowPadding}
      draggable={!renaming}
      title={renaming ? undefined : '拖到 Agent 输入区可附加为引用'}
      onDragStart={(e) => {
        if (renaming) {
          e.preventDefault()
          return
        }
        writeWorkspacePathsToDataTransfer(e.dataTransfer, [node.path])
      }}
      onClick={() => {
        if (!renaming) onSelectFile(node.path)
      }}
      onKeyDown={(e) => {
        if (renaming) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelectFile(node.path)
        }
      }}
      onContextMenu={(e) => onContextMenu(e, node)}
    >
      <FileIcon documentKind={node.documentKind} />
      {renaming ? (
        <input
          ref={inputRef}
          className="min-w-0 flex-1 rounded border border-ring bg-background px-1 py-0.5 text-xs text-foreground outline-none"
          value={inlineEdit.value}
          onChange={(e) => onInlineChange(e.target.value)}
          onBlur={() => onInlineCommit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onInlineCommit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              onInlineCancel()
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="truncate">{node.name}</span>
      )}
    </div>
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
  onHideSidebar,
  treeActions,
}: FileExplorerProps) {
  const rootName = workspaceRoot?.split(/[/\\]/).pop() ?? '工作区'
  const [menu, setMenu] = useState<MenuState>(null)
  const [inlineEdit, setInlineEdit] = useState<InlineEdit>(null)
  const [forceExpandPath, setForceExpandPath] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setMenu(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const openMenu = (event: ReactMouseEvent, target: FileTreeNode | 'root') => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, target })
  }

  const beginRename = (node: FileTreeNode) => {
    setInlineEdit({ mode: 'rename', path: node.path, value: node.name })
    setMenu(null)
  }

  const beginNew = (mode: 'new-file' | 'new-folder', parentDir: string) => {
    if (!treeActions || !workspaceRoot) return
    const value =
      mode === 'new-file'
        ? treeActions.defaultNewFileName(parentDir)
        : treeActions.defaultNewFolderName(parentDir)
    setForceExpandPath(parentDir)
    setInlineEdit({ mode, parentDir, value })
    setMenu(null)
  }

  const commitInline = async () => {
    if (!inlineEdit || !treeActions || !workspaceRoot) {
      setInlineEdit(null)
      return
    }
    const value = inlineEdit.value.trim()
    if (!value) {
      setInlineEdit(null)
      return
    }
    if (inlineEdit.mode === 'rename') {
      await treeActions.rename(inlineEdit.path, value)
    } else if (inlineEdit.mode === 'new-file') {
      await treeActions.createFile(inlineEdit.parentDir, value)
    } else {
      await treeActions.createFolder(inlineEdit.parentDir, value)
    }
    setInlineEdit(null)
    setForceExpandPath(null)
  }

  const rootCreating =
    inlineEdit &&
    (inlineEdit.mode === 'new-file' || inlineEdit.mode === 'new-folder') &&
    workspaceRoot &&
    inlineEdit.parentDir === workspaceRoot

  const menuTarget = menu?.target
  const nodeTarget = menuTarget && menuTarget !== 'root' ? menuTarget : null
  const canPaste = Boolean(treeActions?.clipboard)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FolderOpen className="size-3.5" />
          资源管理器
        </div>
        <div className="flex items-center gap-1">
          {workspaceRoot && treeActions ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                title="新建文件"
                onClick={() => beginNew('new-file', workspaceRoot)}
              >
                <FilePlus className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                title="新建文件夹"
                onClick={() => beginNew('new-folder', workspaceRoot)}
              >
                <FolderPlus className="size-3.5" />
              </Button>
            </>
          ) : null}
          {onHideSidebar ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={onHideSidebar}
              title="隐藏侧栏 (Ctrl+B)"
              aria-label="隐藏侧栏"
            >
              <PanelLeftClose className="size-3.5" />
            </Button>
          ) : null}
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

      <div
        className="min-h-0 flex-1 overflow-auto"
        onContextMenu={(e) => {
          if (!workspaceRoot) return
          openMenu(e, 'root')
        }}
      >
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
            <div
              className="mb-2 truncate px-2 text-xs font-medium text-foreground/80"
              onContextMenu={(e) => openMenu(e, 'root')}
            >
              {rootName}
            </div>
            {rootCreating ? (
              <div className="mb-1 flex items-center gap-2 px-2 py-1" style={{ paddingLeft: 24 }}>
                {inlineEdit.mode === 'new-folder' ? (
                  <Folder className="size-3.5 shrink-0 text-amber-500/90" />
                ) : (
                  <FileText className="size-3.5 shrink-0" />
                )}
                <input
                  autoFocus
                  className="min-w-0 flex-1 rounded border border-ring bg-background px-1 py-0.5 text-xs outline-none"
                  value={inlineEdit.value}
                  onChange={(e) =>
                    setInlineEdit((prev) => (prev ? { ...prev, value: e.target.value } : prev))
                  }
                  onBlur={() => void commitInline()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void commitInline()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setInlineEdit(null)
                    }
                  }}
                />
              </div>
            ) : null}
            {tree.length === 0 && !rootCreating ? (
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
                  onContextMenu={openMenu}
                  inlineEdit={inlineEdit}
                  onInlineChange={(value) =>
                    setInlineEdit((prev) => (prev ? { ...prev, value } : prev))
                  }
                  onInlineCommit={() => void commitInline()}
                  onInlineCancel={() => setInlineEdit(null)}
                  forceExpandPath={forceExpandPath}
                />
              ))
            )}
          </div>
        )}
      </div>

      {menu && treeActions && workspaceRoot ? (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-44 rounded-md border border-border/80 bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          {menuTarget === 'root' || !nodeTarget ? (
            <>
              <MenuItem
                label="新建文件"
                onClick={() => beginNew('new-file', workspaceRoot)}
              />
              <MenuItem
                label="新建文件夹"
                onClick={() => beginNew('new-folder', workspaceRoot)}
              />
              <MenuSeparator />
              <MenuItem
                label="粘贴"
                disabled={!canPaste}
                onClick={() => {
                  setMenu(null)
                  void treeActions.pasteInto('root')
                }}
              />
              <MenuSeparator />
              <MenuItem
                label="复制完整路径"
                onClick={() => {
                  setMenu(null)
                  void treeActions.copyFullPath(workspaceRoot)
                }}
              />
              <MenuItem
                label="在资源管理器中刷新"
                onClick={() => {
                  setMenu(null)
                  onRescanWorkspace?.()
                }}
              />
            </>
          ) : (
            <>
              <MenuItem
                label="新建文件"
                onClick={() => {
                  const parent =
                    nodeTarget.type === 'directory'
                      ? nodeTarget.path
                      : getParentDir(nodeTarget.path)
                  beginNew('new-file', parent)
                }}
              />
              <MenuItem
                label="新建文件夹"
                onClick={() => {
                  const parent =
                    nodeTarget.type === 'directory'
                      ? nodeTarget.path
                      : getParentDir(nodeTarget.path)
                  beginNew('new-folder', parent)
                }}
              />
              <MenuSeparator />
              <MenuItem
                label="剪切"
                onClick={() => {
                  treeActions.setCut(nodeTarget)
                  setMenu(null)
                }}
              />
              <MenuItem
                label="复制"
                onClick={() => {
                  treeActions.setCopy(nodeTarget)
                  setMenu(null)
                }}
              />
              <MenuItem
                label="粘贴"
                disabled={!canPaste}
                onClick={() => {
                  setMenu(null)
                  void treeActions.pasteInto(nodeTarget)
                }}
              />
              <MenuSeparator />
              <MenuItem label="重命名" onClick={() => beginRename(nodeTarget)} />
              <MenuItem
                label="删除"
                danger
                onClick={() => {
                  setMenu(null)
                  void treeActions.remove(nodeTarget)
                }}
              />
              <MenuSeparator />
              <MenuItem
                label="复制完整路径"
                onClick={() => {
                  setMenu(null)
                  void treeActions.copyFullPath(nodeTarget.path)
                }}
              />
              <MenuItem
                label="复制相对路径"
                onClick={() => {
                  setMenu(null)
                  void treeActions.copyRelativePath(nodeTarget.path)
                }}
              />
              {nodeTarget.type === 'file' && isMarkdownPath(nodeTarget.path) ? (
                <>
                  <MenuSeparator />
                  <MenuItem
                    label="导出为 PDF"
                    onClick={() => {
                      setMenu(null)
                      void treeActions.exportMarkdownPdf(nodeTarget.path)
                    }}
                  />
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
