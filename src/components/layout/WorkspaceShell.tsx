import { useEffect, type ReactNode } from 'react'
import { useDefaultLayout } from 'react-resizable-panels'
import { TitleBar } from '@/components/layout/TitleBar'
import { ActivityBar } from '@/components/layout/ActivityBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { AgentPanel } from '@/components/agent/AgentPanel'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useCollapsiblePanelSync } from '@/hooks/useSidebarPanelSync'
import type { MarkdownHeading } from '@/lib/markdown-headings'
import { useEditorUiStore } from '@/stores/editor-ui-store'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import type { FileTreeNode } from '@shared/types/file'
import type { useFileTreeActions } from '@/hooks/useFileTreeActions'

export interface WorkspaceShellProps {
  theme: 'dark' | 'light'
  workspaceRoot?: string
  fileTree: FileTreeNode[]
  activeFilePath?: string
  recentFiles: string[]
  treeActions?: ReturnType<typeof useFileTreeActions>
  /** Markdown 大纲；阅读器模式传空数组即可 */
  headings?: MarkdownHeading[]
  activeHeadingId?: string
  onSelectHeading?: (heading: MarkdownHeading) => void
  /** 阅读器：禁用保存/导出 */
  readOnly?: boolean
  onOpenFile: () => void
  onOpenFolder: () => void
  onRescanWorkspace?: () => void
  isRescanningWorkspace?: boolean
  onSelectFile: (path: string) => void
  onOpenRecentFile: (path: string) => void
  onToggleTheme: () => void
  onSave: () => void
  onSaveAs: () => void
  onExportHtml: () => void
  onExportPdf: () => void
  onOpenSettings: () => void
  onOpenErrorLog: () => void
  onOpenDevTools: () => void
  onAbout: () => void
  onNewWindow: () => void
  onQuit: () => void
  children: ReactNode
}

/**
 * 工作区外壳：TitleBar / ActivityBar / 侧栏 / Agent 常驻。
 * 切换 Markdown ↔ PDF 时只替换 children（主区），避免 Agent 面板整树卸载。
 */
export function WorkspaceShell({
  theme,
  workspaceRoot,
  fileTree,
  activeFilePath,
  recentFiles,
  treeActions,
  headings = [],
  activeHeadingId,
  onSelectHeading,
  readOnly = false,
  onOpenFile,
  onOpenFolder,
  onRescanWorkspace,
  isRescanningWorkspace,
  onSelectFile,
  onOpenRecentFile,
  onToggleTheme,
  onSave,
  onSaveAs,
  onExportHtml,
  onExportPdf,
  onOpenSettings,
  onOpenErrorLog,
  onOpenDevTools,
  onAbout,
  onNewWindow,
  onQuit,
  children,
}: WorkspaceShellProps) {
  const sidebarVisible = useEditorUiStore((state) => state.sidebarVisible)
  const setSidebarVisible = useEditorUiStore((state) => state.setSidebarVisible)
  const toggleSidebar = useEditorUiStore((state) => state.toggleSidebar)
  const outlineExpanded = useEditorUiStore((state) => state.outlineExpanded)
  const setOutlineExpanded = useEditorUiStore((state) => state.setOutlineExpanded)
  const agentPanelOpen = useAcpUiStore((state) => state.panelOpen)
  const toggleAgentPanel = useAcpUiStore((state) => state.togglePanel)
  const sidebarPanelRef = useCollapsiblePanelSync(sidebarVisible)
  const agentPanelRef = useCollapsiblePanelSync(agentPanelOpen)

  const shellLayout = useDefaultLayout({
    id: 'workspace-shell',
    panelIds: ['sidebar', 'main', 'agent'],
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return
      if (event.key.toLowerCase() !== 'a') return
      event.preventDefault()
      toggleAgentPanel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleAgentPanel])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TitleBar
        theme={theme}
        recentFiles={recentFiles}
        sidebarVisible={sidebarVisible}
        agentPanelOpen={agentPanelOpen}
        readOnly={readOnly}
        onToggleSidebar={toggleSidebar}
        onToggleAgentPanel={toggleAgentPanel}
        onToggleTheme={onToggleTheme}
        onOpenFile={onOpenFile}
        onOpenFolder={onOpenFolder}
        onOpenRecentFile={onOpenRecentFile}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onExportHtml={onExportHtml}
        onExportPdf={onExportPdf}
        onOpenSettings={onOpenSettings}
        onOpenErrorLog={onOpenErrorLog}
        onOpenDevTools={onOpenDevTools}
        onAbout={onAbout}
        onNewWindow={onNewWindow}
        onQuit={onQuit}
      />

      <div className="flex min-h-0 flex-1">
        <ActivityBar
          sidebarVisible={sidebarVisible}
          agentPanelOpen={agentPanelOpen}
          onToggleSidebar={toggleSidebar}
          onToggleAgentPanel={toggleAgentPanel}
        />

        <ResizablePanelGroup
          id="workspace-shell"
          orientation="horizontal"
          defaultLayout={shellLayout.defaultLayout}
          onLayoutChanged={shellLayout.onLayoutChanged}
          className="min-h-0 min-w-0 flex-1"
        >
          <ResizablePanel
            id="sidebar"
            panelRef={sidebarPanelRef}
            collapsible
            collapsedSize={0}
            defaultSize="18%"
            minSize="12%"
            maxSize="36%"
            className="min-w-0"
          >
            <Sidebar
              workspaceRoot={workspaceRoot}
              fileTree={fileTree}
              activeFilePath={activeFilePath}
              headings={headings}
              activeHeadingId={activeHeadingId}
              outlineExpanded={outlineExpanded && headings.length > 0}
              onOutlineToggle={() => setOutlineExpanded(!outlineExpanded)}
              onOpenFolder={onOpenFolder}
              onRescanWorkspace={onRescanWorkspace}
              isRescanningWorkspace={isRescanningWorkspace}
              onSelectFile={onSelectFile}
              onSelectHeading={onSelectHeading ?? (() => undefined)}
              onHideSidebar={() => setSidebarVisible(false)}
              treeActions={treeActions}
            />
          </ResizablePanel>

          {sidebarVisible ? <ResizableHandle withHandle /> : null}

          <ResizablePanel id="main" defaultSize="57%" minSize="30%" className="min-w-0">
            {children}
          </ResizablePanel>

          {agentPanelOpen ? <ResizableHandle withHandle /> : null}

          <ResizablePanel
            id="agent"
            panelRef={agentPanelRef}
            collapsible
            collapsedSize={0}
            defaultSize="25%"
            minSize="16%"
            maxSize="45%"
            className="min-w-0"
          >
            <AgentPanel workspaceRoot={workspaceRoot} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
