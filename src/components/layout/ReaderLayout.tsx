import { useDefaultLayout } from 'react-resizable-panels'
import { TitleBar } from '@/components/layout/TitleBar'
import { FileExplorer } from '@/components/layout/FileExplorer'
import { FileBreadcrumb } from '@/components/layout/FileBreadcrumb'
import { EpubViewer } from '@/components/reader/EpubViewer'
import { PdfViewer } from '@/components/reader/PdfViewer'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import type { ReaderDocumentKind } from '@shared/document-types'
import type { FileTreeNode } from '@shared/file-types'

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
  onQuit,
}: ReaderLayoutProps) {
  const sidebarLayout = useDefaultLayout({
    id: 'reader-sidebar-main',
    panelIds: ['sidebar', 'main'],
  })

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TitleBar
        theme={theme}
        recentFiles={recentFiles}
        readOnly
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
        onQuit={onQuit}
      />

      <ResizablePanelGroup
        id="reader-sidebar-main"
        orientation="horizontal"
        defaultLayout={sidebarLayout.defaultLayout}
        onLayoutChanged={sidebarLayout.onLayoutChanged}
        className="min-h-0 flex-1"
      >
        <ResizablePanel id="sidebar" defaultSize="20%" minSize="14%" maxSize="40%" className="min-w-0">
          <FileExplorer
            workspaceRoot={workspaceRoot}
            tree={fileTree}
            activeFilePath={filePath}
            onOpenFolder={onOpenFolder}
            onRescanWorkspace={onRescanWorkspace}
            isRescanning={isRescanningWorkspace}
            onSelectFile={onSelectFile}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel id="main" defaultSize="80%" minSize="45%" className="min-w-0">
          <div className="flex h-full min-h-0 flex-col">
            <FileBreadcrumb filePath={filePath} isDirty={false} />
            <main className="min-h-0 flex-1 bg-editor">
              {documentKind === 'pdf' ? (
                <PdfViewer filePath={filePath} theme={theme} />
              ) : (
                <EpubViewer filePath={filePath} theme={theme} />
              )}
            </main>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
