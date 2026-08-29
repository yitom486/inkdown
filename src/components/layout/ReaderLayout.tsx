import { useEffect } from 'react'
import { useDefaultLayout } from 'react-resizable-panels'
import { TitleBar } from '@/components/layout/TitleBar'
import { ActivityBar } from '@/components/layout/ActivityBar'
import { FileExplorer } from '@/components/layout/FileExplorer'
import { FileBreadcrumb } from '@/components/layout/FileBreadcrumb'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { EpubViewer } from '@/components/reader/EpubViewer'
import { MobiViewer } from '@/components/reader/MobiViewer'
import { PdfViewer } from '@/components/reader/PdfViewer'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useSidebarPanelSync } from '@/hooks/useSidebarPanelSync'
import { useEditorUiStore } from '@/stores/editor-ui-store'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import type { ReaderDocumentKind } from '@shared/types/document'
import type { FileTreeNode } from '@shared/types/file'

interface ReaderLayoutProps {
  filePath: string
  documentKind: ReaderDocumentKind
  theme: 'dark' | 'light'
  workspaceRoot?: string
  fileTree: FileTreeNode[]
  recentFiles: string[]
  onOpenFile: () => void
  onOpenFolder: () => void
  onRescanWorkspace?: () => void
  isRescanningWorkspace?: boolean
  onSelectFile: (path: string) => void
  onOpenRecentFile: (path: string) => void
  onToggleTheme: () => void
  onOpenSettings: () => void
  onOpenErrorLog: () => void
  onOpenDevTools: () => void
  onAbout: () => void
  onNewWindow: () => void
  onQuit: () => void
}

export function ReaderLayout({
  filePath,
  documentKind,
  theme,
  workspaceRoot,
  fileTree,
  recentFiles,
  onOpenFile,
  onOpenFolder,
  onRescanWorkspace,
  isRescanningWorkspace,
  onSelectFile,
  onOpenRecentFile,
  onToggleTheme,
  onOpenSettings,
  onOpenErrorLog,
  onOpenDevTools,
  onAbout,
  onNewWindow,
  onQuit,
}: ReaderLayoutProps) {
  const sidebarVisible = useEditorUiStore((state) => state.sidebarVisible)
  const setSidebarVisible = useEditorUiStore((state) => state.setSidebarVisible)
  const toggleSidebar = useEditorUiStore((state) => state.toggleSidebar)
  const agentPanelOpen = useAcpUiStore((state) => state.panelOpen)
  const toggleAgentPanel = useAcpUiStore((state) => state.togglePanel)
  const sidebarPanelRef = useSidebarPanelSync(sidebarVisible)

  const sidebarLayout = useDefaultLayout({
    id: 'reader-sidebar-main',
    panelIds: ['sidebar', 'main'],
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
        readOnly
        onToggleSidebar={toggleSidebar}
        onToggleAgentPanel={toggleAgentPanel}
        onToggleTheme={onToggleTheme}
        onOpenFile={onOpenFile}
        onOpenFolder={onOpenFolder}
        onOpenRecentFile={onOpenRecentFile}
        onSave={() => undefined}
        onSaveAs={() => undefined}
        onExportHtml={() => undefined}
        onExportPdf={() => undefined}
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
        {agentPanelOpen ? <AgentPanel workspaceRoot={workspaceRoot} /> : null}

        <ResizablePanelGroup
        id="reader-sidebar-main"
        orientation="horizontal"
        defaultLayout={sidebarLayout.defaultLayout}
        onLayoutChanged={sidebarLayout.onLayoutChanged}
        className="min-h-0 min-w-0 flex-1"
      >
        <ResizablePanel
          id="sidebar"
          panelRef={sidebarPanelRef}
          collapsible
          collapsedSize={0}
          defaultSize="20%"
          minSize="14%"
          maxSize="40%"
          className="min-w-0"
        >
          <FileExplorer
            workspaceRoot={workspaceRoot}
            tree={fileTree}
            activeFilePath={filePath}
            onOpenFolder={onOpenFolder}
            onRescanWorkspace={onRescanWorkspace}
            isRescanning={isRescanningWorkspace}
            onSelectFile={onSelectFile}
            onHideSidebar={() => setSidebarVisible(false)}
          />
        </ResizablePanel>

        {sidebarVisible && <ResizableHandle withHandle />}

        <ResizablePanel id="main" defaultSize="80%" minSize="45%" className="min-w-0">
          <div className="flex h-full min-h-0 flex-col">
            <FileBreadcrumb filePath={filePath} isDirty={false} />
            <main className="min-h-0 flex-1 bg-editor">
              {documentKind === 'pdf' ? (
                <PdfViewer filePath={filePath} theme={theme} />
              ) : documentKind === 'mobi' ? (
                <MobiViewer filePath={filePath} theme={theme} />
              ) : (
                <EpubViewer filePath={filePath} theme={theme} />
              )}
            </main>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      </div>
    </div>
  )
}
