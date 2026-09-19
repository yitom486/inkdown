import { useEffect, type ReactNode } from 'react'
import { useDefaultLayout } from 'react-resizable-panels'
import { TitleBar } from '@/components/layout/TitleBar'
import { ActivityBar } from '@/components/layout/ActivityBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { FloatingAIHud } from '@/components/agent/FloatingAIHud'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useCollapsiblePanelSync } from '@/hooks/workspace/useSidebarPanelSync'
import type { MarkdownHeading } from '@/lib/editor/markdown-headings'
import { useEditorUiStore } from '@/stores/editor-ui-store'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import type { FileTreeNode } from '@inkdown/contracts'
import type { useFileTreeActions } from '@/hooks/workspace/useFileTreeActions'
import { preserveScrollAnchor } from '@/lib/reader/scroll-anchor'
import { DiagramModal } from '@/components/agent/DiagramModal'
import { NotesDrawer } from '@/components/reader/NotesDrawer'
import { LibraryDrawer } from '@/components/reader/LibraryDrawer'
import { useReaderHudUiStore } from '@/stores/acp/reader-hud-store'
import { useReadingMarks } from '@/hooks/reader/useReadingMarks'

export interface WorkspaceShellProps {
  theme: 'dark' | 'light'
  workspaceRoot?: string
  fileTree: FileTreeNode[]
  activeFilePath?: string
  webPageUrl?: string | null
  recentWebUrls?: string[]
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
  onQuickOpen?: () => void
  onFind?: () => void
  onReplace?: () => void
  onOpenWebDoc?: (url: string) => void
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
  webPageUrl,
  recentWebUrls,
  recentFiles,
  treeActions,
  headings = [],
  activeHeadingId,
  onSelectHeading,
  readOnly = false,
  onOpenFile,
  onOpenFolder,
  onQuickOpen,
  onFind,
  onReplace,
  onOpenWebDoc,
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
  const hudDisplayMode = useAcpUiStore((state) => state.hudDisplayMode)
  const isDockedPanelVisible = agentPanelOpen && hudDisplayMode === 'docked'
  const toggleAgentPanel = useAcpUiStore((state) => state.togglePanel)
  const isNotesDrawerOpen = useReaderHudUiStore((state) => state.isNotesDrawerOpen)
  const setIsNotesDrawerOpen = useReaderHudUiStore((state) => state.setIsNotesDrawerOpen)
  const isLibraryOpen = useReaderHudUiStore((state) => state.isLibraryOpen)
  const setIsLibraryOpen = useReaderHudUiStore((state) => state.setIsLibraryOpen)
  const selectedDiagram = useReaderHudUiStore((state) => state.selectedDiagram)
  const setSelectedDiagram = useReaderHudUiStore((state) => state.setSelectedDiagram)
  const zenMode = useReaderHudUiStore((state) => state.zenMode)
  const setZenMode = useReaderHudUiStore((state) => state.setZenMode)
  const toggleZenMode = useReaderHudUiStore((state) => state.toggleZenMode)

  const { marks, deleteMark } = useReadingMarks(activeFilePath || '')

  const sidebarPanelRef = useCollapsiblePanelSync(sidebarVisible)
  const agentPanelRef = useCollapsiblePanelSync(isDockedPanelVisible)

  const shellLayout = useDefaultLayout({
    id: 'workspace-shell',
    panelIds: ['sidebar', 'main', 'agent'],
  })

  const handleToggleSidebar = () => {
    preserveScrollAnchor(() => toggleSidebar())
  }

  const handleSetSidebarVisible = (visible: boolean) => {
    preserveScrollAnchor(() => setSidebarVisible(visible))
  }

  const handleToggleAgentPanel = () => {
    preserveScrollAnchor(() => toggleAgentPanel())
  }

  const handleLayoutChanged: typeof shellLayout.onLayoutChanged = (layout, meta) => {
    preserveScrollAnchor(() => shellLayout.onLayoutChanged(layout, meta))
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && zenMode) {
        setZenMode(false)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        toggleZenMode()
        return
      }
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return
      if (event.key.toLowerCase() !== 'a') return
      event.preventDefault()
      handleToggleAgentPanel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleToggleAgentPanel, zenMode, setZenMode, toggleZenMode])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TitleBar
        theme={theme}
        recentFiles={recentFiles}
        sidebarVisible={sidebarVisible}
        agentPanelOpen={agentPanelOpen}
        readOnly={readOnly}
        onToggleSidebar={handleToggleSidebar}
        onToggleAgentPanel={handleToggleAgentPanel}
        onToggleTheme={onToggleTheme}
        onOpenFile={onOpenFile}
        onOpenFolder={onOpenFolder}
        onQuickOpen={onQuickOpen}
        onFind={onFind}
        onReplace={onReplace}
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
          onToggleSidebar={handleToggleSidebar}
          onToggleAgentPanel={handleToggleAgentPanel}
          onOpenLibrary={() => setIsLibraryOpen(true)}
          onOpenNotes={() => setIsNotesDrawerOpen(true)}
        />

        <ResizablePanelGroup
          id="workspace-shell"
          orientation="horizontal"
          defaultLayout={shellLayout.defaultLayout}
          onLayoutChanged={handleLayoutChanged}
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
              webPageUrl={webPageUrl}
              recentWebUrls={recentWebUrls}
              headings={headings}
              activeHeadingId={activeHeadingId}
              outlineExpanded={outlineExpanded && headings.length > 0}
              onOutlineToggle={() => setOutlineExpanded(!outlineExpanded)}
              onOpenFolder={onOpenFolder}
              onOpenWebDoc={onOpenWebDoc}
              onRescanWorkspace={onRescanWorkspace}
              isRescanningWorkspace={isRescanningWorkspace}
              onSelectFile={onSelectFile}
              onSelectHeading={onSelectHeading ?? (() => undefined)}
              onHideSidebar={() => handleSetSidebarVisible(false)}
              treeActions={treeActions}
            />
          </ResizablePanel>

          {sidebarVisible ? <ResizableHandle withHandle /> : null}

          <ResizablePanel id="main" defaultSize="57%" minSize="30%" className="min-w-0">
            {children}
          </ResizablePanel>

          {isDockedPanelVisible ? <ResizableHandle withHandle /> : null}

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

      <FloatingAIHud workspaceRoot={workspaceRoot} />

      <DiagramModal
        isOpen={!!selectedDiagram}
        onClose={() => setSelectedDiagram(null)}
        diagram={selectedDiagram}
      />

      <NotesDrawer
        isOpen={isNotesDrawerOpen}
        onClose={() => setIsNotesDrawerOpen(false)}
        marks={marks ?? []}
        bookTitle={activeFilePath ? activeFilePath.split(/[/\\]/).pop() : undefined}
        onDeleteMark={(id) => void deleteMark(id)}
      />

      <LibraryDrawer
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        recentFiles={recentFiles}
        activeFilePath={activeFilePath}
        onSelectFile={onSelectFile}
        recentWebUrls={recentWebUrls}
        webPageUrl={webPageUrl}
        onOpenWebDoc={onOpenWebDoc}
        onOpenFile={onOpenFile}
      />
    </div>
  )
}
