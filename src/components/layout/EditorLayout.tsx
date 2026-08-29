import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { reportRuntimeError } from '@/lib/error-reporter'
import { useDefaultLayout } from 'react-resizable-panels'
import { TitleBar } from '@/components/layout/TitleBar'
import { ActivityBar } from '@/components/layout/ActivityBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { FileBreadcrumb } from '@/components/layout/FileBreadcrumb'
import { WelcomePage } from '@/components/layout/WelcomePage'
import { ViewModeToggle } from '@/components/layout/ViewModeToggle'
import { AgentPanel } from '@/components/agent/AgentPanel'
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from '@/components/editor/MarkdownEditor'
import { FindReplaceBar } from '@/components/editor/FindReplaceBar'
import { PreviewPane, type PreviewPaneHandle } from '@/components/preview/PreviewPane'
import { PaneErrorBoundary } from '@/components/shared/PaneErrorBoundary'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useScrollSync } from '@/hooks/useScrollSync'
import { useCollapsiblePanelSync } from '@/hooks/useSidebarPanelSync'
import { useMarkdownPreview } from '@/hooks/useMarkdownPreview'
import { usePasteImage } from '@/hooks/usePasteImage'
import {
  findActiveHeading,
  parseMarkdownHeadings,
  type MarkdownHeading,
} from '@/lib/markdown-headings'
import { useEditorUiStore, useFileUiState, type EditorViewMode } from '@/stores/editor-ui-store'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import { useAppSettingsStore } from '@/stores/app-settings-store'
import type { FileTreeNode } from '@shared/types/file'
import type { useFileTreeActions } from '@/hooks/useFileTreeActions'

interface EditorLayoutProps {
  filePath?: string
  isDirty: boolean
  content: string
  workspaceRoot?: string
  fileTree: FileTreeNode[]
  recentFiles: string[]
  treeActions?: ReturnType<typeof useFileTreeActions>
  onContentChange: (value: string) => void
  onOpenFile: () => void
  onOpenFolder: () => void
  onRescanWorkspace?: () => void
  isRescanningWorkspace?: boolean
  onSelectFile: (path: string) => void
  onOpenRecentFile: (path: string) => void
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
}

export function EditorLayout({
  filePath,
  isDirty,
  content,
  workspaceRoot,
  fileTree,
  recentFiles,
  treeActions,
  onContentChange,
  onOpenFile,
  onOpenFolder,
  onRescanWorkspace,
  isRescanningWorkspace,
  onSelectFile,
  onOpenRecentFile,
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
}: EditorLayoutProps) {
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const previewRef = useRef<PreviewPaneHandle>(null)

  const fileState = useFileUiState(filePath)
  const setViewMode = useEditorUiStore((state) => state.setViewMode)
  const theme = useEditorUiStore((state) => state.theme)
  const toggleTheme = useEditorUiStore((state) => state.toggleTheme)
  const outlineExpanded = useEditorUiStore((state) => state.outlineExpanded)
  const setOutlineExpanded = useEditorUiStore((state) => state.setOutlineExpanded)
  const sidebarVisible = useEditorUiStore((state) => state.sidebarVisible)
  const setSidebarVisible = useEditorUiStore((state) => state.setSidebarVisible)
  const toggleSidebar = useEditorUiStore((state) => state.toggleSidebar)
  const agentPanelOpen = useAcpUiStore((state) => state.panelOpen)
  const toggleAgentPanel = useAcpUiStore((state) => state.togglePanel)
  const sidebarPanelRef = useCollapsiblePanelSync(sidebarVisible)
  const agentPanelRef = useCollapsiblePanelSync(agentPanelOpen)
  const previewDebounceMs = useAppSettingsStore((state) => state.previewDebounceMs)
  const tabSize = useAppSettingsStore((state) => state.tabSize)
  const editorFontSize = useAppSettingsStore((state) => state.editorFontSize)

  const viewMode = fileState.viewMode
  const previewHtml = useMarkdownPreview(content, filePath, previewDebounceMs)
  const { handlePasteImage } = usePasteImage(filePath)
  const headings = useMemo(() => {
    try {
      return parseMarkdownHeadings(content)
    } catch (error) {
      reportRuntimeError(error, { source: 'outline', filePath, silentToast: true })
      return []
    }
  }, [content, filePath])
  const [activeHeadingId, setActiveHeadingId] = useState<string>()
  const [findReplace, setFindReplace] = useState<{ open: boolean; mode: 'find' | 'replace' }>({
    open: false,
    mode: 'find',
  })

  const showEditor = Boolean(filePath) && (viewMode === 'editor' || viewMode === 'split')
  const showPreview = Boolean(filePath) && (viewMode === 'preview' || viewMode === 'split')
  const showWelcome = !filePath

  const contentPanelIds = useMemo(() => {
    if (showEditor && showPreview) return ['editor', 'preview']
    if (showEditor) return ['editor']
    return ['preview-full']
  }, [showEditor, showPreview])

  const sidebarLayout = useDefaultLayout({
    id: 'markdown-editor-shell',
    panelIds: ['sidebar', 'main', 'agent'],
  })

  const contentLayout = useDefaultLayout({
    id: `markdown-editor-content-${viewMode}`,
    panelIds: contentPanelIds,
  })

  const updateActiveHeading = useCallback(() => {
    const visibleLine = editorRef.current?.getTopVisibleLine() ?? 0
    const active = findActiveHeading(headings, visibleLine)
    setActiveHeadingId(active?.id)
  }, [headings])

  const { onEditorScroll, onPreviewScroll, jumpToHeading } = useScrollSync({
    filePath,
    viewMode,
    previewHtml,
    editorRef,
    previewRef,
  })

  const handleEditorScroll = useCallback(() => {
    onEditorScroll()
    if (viewMode !== 'preview') {
      updateActiveHeading()
    }
  }, [onEditorScroll, updateActiveHeading, viewMode])

  const updateActiveHeadingFromPreview = useCallback(() => {
    const activeId = previewRef.current?.getActiveHeadingId()
    if (activeId) {
      setActiveHeadingId(activeId)
    }
  }, [])

  const handlePreviewScroll = useCallback(() => {
    onPreviewScroll()
    if (viewMode !== 'editor') {
      updateActiveHeadingFromPreview()
    }
  }, [onPreviewScroll, updateActiveHeadingFromPreview, viewMode])

  const handlePreviewHeadingActivate = useCallback(
    (headingId: string) => {
      setActiveHeadingId(headingId)
      const heading = headings.find((item) => item.id === headingId)
      if (!heading || viewMode === 'preview') return

      editorRef.current?.scrollToLine(heading.line)
    },
    [headings, viewMode],
  )

  const handleSelectHeading = useCallback(
    (heading: MarkdownHeading) => {
      jumpToHeading(heading)
      setActiveHeadingId(heading.id)
    },
    [jumpToHeading],
  )

  useEffect(() => {
    if (viewMode === 'preview' && previewHtml) {
      requestAnimationFrame(() => {
        updateActiveHeadingFromPreview()
      })
    }
  }, [previewHtml, updateActiveHeadingFromPreview, viewMode])

  useEffect(() => {
    if (viewMode !== 'preview') {
      updateActiveHeading()
    }
  }, [headings, updateActiveHeading, viewMode])

  useEffect(() => {
    if (!filePath) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return

      const key = event.key.toLowerCase()
      if (key === 'f') {
        event.preventDefault()
        setFindReplace({ open: true, mode: 'find' })
        return
      }
      if (key === 'h') {
        event.preventDefault()
        setFindReplace({ open: true, mode: 'replace' })
        return
      }

      const shortcuts: Record<string, EditorViewMode> = {
        '1': 'editor',
        '2': 'split',
        '3': 'preview',
      }
      const nextMode = shortcuts[event.key]
      if (!nextMode) return

      event.preventDefault()
      setViewMode(filePath, nextMode)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filePath, setViewMode])

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
        onToggleSidebar={toggleSidebar}
        onToggleAgentPanel={toggleAgentPanel}
        onToggleTheme={toggleTheme}
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
          id="markdown-editor-shell"
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
            defaultSize="18%"
            minSize="12%"
            maxSize="36%"
            className="min-w-0"
          >
            <Sidebar
              workspaceRoot={workspaceRoot}
              fileTree={fileTree}
              activeFilePath={filePath}
              headings={headings}
              activeHeadingId={activeHeadingId}
              outlineExpanded={outlineExpanded}
              onOutlineToggle={() => setOutlineExpanded(!outlineExpanded)}
              onOpenFolder={onOpenFolder}
              onRescanWorkspace={onRescanWorkspace}
              isRescanningWorkspace={isRescanningWorkspace}
              onSelectFile={onSelectFile}
              onSelectHeading={handleSelectHeading}
              onHideSidebar={() => setSidebarVisible(false)}
              treeActions={treeActions}
            />
          </ResizablePanel>

          {sidebarVisible ? <ResizableHandle withHandle /> : null}

          <ResizablePanel id="main" defaultSize="57%" minSize="30%" className="min-w-0">
            <div className="flex h-full min-h-0 flex-col">
              <FileBreadcrumb
                filePath={filePath}
                isDirty={isDirty}
                welcome={showWelcome}
                trailing={
                  showWelcome ? undefined : (
                    <ViewModeToggle
                      mode={viewMode}
                      onChange={(mode) => setViewMode(filePath, mode)}
                    />
                  )
                }
              />

              <main className="min-h-0 flex-1 bg-editor">
                {showWelcome ? (
                  <WelcomePage
                    recentFiles={recentFiles}
                    workspaceRoot={workspaceRoot}
                    onOpenFile={onOpenFile}
                    onOpenFolder={onOpenFolder}
                    onOpenRecentFile={onOpenRecentFile}
                  />
                ) : (
                  <ResizablePanelGroup
                    id={`markdown-editor-content-${viewMode}`}
                    orientation="horizontal"
                    defaultLayout={contentLayout.defaultLayout}
                    onLayoutChanged={contentLayout.onLayoutChanged}
                    className="h-full min-h-0"
                  >
                    {showEditor && (
                      <ResizablePanel
                        id="editor"
                        defaultSize={showPreview ? '50%' : '100%'}
                        minSize={showPreview ? '28%' : '100%'}
                        className="min-w-0"
                      >
                        <div className="relative h-full min-h-0">
                          <FindReplaceBar
                            open={findReplace.open}
                            mode={findReplace.mode}
                            editorView={editorRef.current?.getView() ?? null}
                            onClose={() =>
                              setFindReplace((state) => ({ ...state, open: false }))
                            }
                          />
                          <PaneErrorBoundary name="编辑器" filePath={filePath}>
                            <MarkdownEditor
                              ref={editorRef}
                              value={content}
                              filePath={filePath}
                              theme={theme}
                              tabSize={tabSize}
                              fontSize={editorFontSize}
                              onChange={onContentChange}
                              onScroll={handleEditorScroll}
                              onPasteImage={handlePasteImage}
                            />
                          </PaneErrorBoundary>
                        </div>
                      </ResizablePanel>
                    )}

                    {showEditor && showPreview && (
                      <>
                        <ResizableHandle withHandle />
                        <ResizablePanel
                          id="preview"
                          defaultSize="50%"
                          minSize="28%"
                          className="min-w-0"
                        >
                          <PaneErrorBoundary name="预览" filePath={filePath}>
                            <PreviewPane
                              ref={previewRef}
                              html={previewHtml}
                              theme={theme}
                              onScroll={handlePreviewScroll}
                              onHeadingActivate={handlePreviewHeadingActivate}
                            />
                          </PaneErrorBoundary>
                        </ResizablePanel>
                      </>
                    )}

                    {!showEditor && showPreview && (
                      <ResizablePanel id="preview-full" defaultSize="100%" className="min-w-0">
                        <PaneErrorBoundary name="预览" filePath={filePath}>
                          <PreviewPane
                            ref={previewRef}
                            html={previewHtml}
                            theme={theme}
                            onScroll={handlePreviewScroll}
                            onHeadingActivate={handlePreviewHeadingActivate}
                          />
                        </PaneErrorBoundary>
                      </ResizablePanel>
                    )}
                  </ResizablePanelGroup>
                )}
              </main>
            </div>
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
