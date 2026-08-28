import { useDefaultLayout } from 'react-resizable-panels'
import { FileExplorer } from '@/components/layout/FileExplorer'
import { DocumentOutline } from '@/components/layout/DocumentOutline'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import type { MarkdownHeading } from '@/lib/markdown-headings'
import type { FileTreeNode } from '@shared/types/file'

interface SidebarProps {
  workspaceRoot?: string
  fileTree: FileTreeNode[]
  activeFilePath?: string
  headings: MarkdownHeading[]
  activeHeadingId?: string
  outlineExpanded: boolean
  onOutlineToggle: () => void
  onOpenFolder: () => void
  onRescanWorkspace?: () => void
  isRescanningWorkspace?: boolean
  onSelectFile: (path: string) => void
  onSelectHeading: (heading: MarkdownHeading) => void
}

export function Sidebar({
  workspaceRoot,
  fileTree,
  activeFilePath,
  headings,
  activeHeadingId,
  outlineExpanded,
  onOutlineToggle,
  onOpenFolder,
  onRescanWorkspace,
  isRescanningWorkspace,
  onSelectFile,
  onSelectHeading,
}: SidebarProps) {
  const outlineLayout = useDefaultLayout({
    id: 'markdown-editor-explorer-outline',
    panelIds: ['explorer', 'outline'],
  })

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-sidebar">
      {outlineExpanded ? (
        <ResizablePanelGroup
          id="markdown-editor-explorer-outline"
          orientation="vertical"
          defaultLayout={outlineLayout.defaultLayout}
          onLayoutChanged={outlineLayout.onLayoutChanged}
          className="h-full min-h-0"
        >
          <ResizablePanel id="explorer" defaultSize="68%" minSize="25%" className="min-h-0">
            <FileExplorer
              workspaceRoot={workspaceRoot}
              tree={fileTree}
              activeFilePath={activeFilePath}
              onOpenFolder={onOpenFolder}
              onRescanWorkspace={onRescanWorkspace}
              isRescanning={isRescanningWorkspace}
              onSelectFile={onSelectFile}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel id="outline" defaultSize="32%" minSize="15%" className="min-h-0">
            <DocumentOutline
              headings={headings}
              activeHeadingId={activeHeadingId}
              onToggle={onOutlineToggle}
              onSelectHeading={onSelectHeading}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-hidden">
            <FileExplorer
              workspaceRoot={workspaceRoot}
              tree={fileTree}
              activeFilePath={activeFilePath}
              onOpenFolder={onOpenFolder}
              onRescanWorkspace={onRescanWorkspace}
              isRescanning={isRescanningWorkspace}
              onSelectFile={onSelectFile}
            />
          </div>
          <DocumentOutline
            headings={headings}
            collapsed
            activeHeadingId={activeHeadingId}
            onToggle={onOutlineToggle}
            onSelectHeading={onSelectHeading}
          />
        </>
      )}
    </div>
  )
}
