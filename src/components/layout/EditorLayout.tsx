import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDefaultLayout } from 'react-resizable-panels'
import { TitleBar } from '@/components/layout/TitleBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { FileBreadcrumb } from '@/components/layout/FileBreadcrumb'
import { ViewModeToggle } from '@/components/layout/ViewModeToggle'
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from '@/components/editor/MarkdownEditor'
import { FindReplaceBar } from '@/components/editor/FindReplaceBar'
import { PreviewPane, type PreviewPaneHandle } from '@/components/preview/PreviewPane'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useScrollSync } from '@/hooks/useScrollSync'
import { useMarkdownPreview } from '@/hooks/useMarkdownPreview'
import {
  findActiveHeading,
  parseMarkdownHeadings,
  type MarkdownHeading,
} from '@/lib/markdown-headings'
import { useEditorUiStore, type EditorViewMode } from '@/stores/editor-ui-store'
import type { FileTreeNode } from '@shared/file-types'

interface EditorLayoutProps {
  filePath?: string
  isDirty: boolean
  content: string
  workspaceRoot?: string
  fileTree: FileTreeNode[]
  recentFiles: string[]
  onContentChange: (value: string) => void
  onOpenFile: () => void
  onOpenFolder: () => void
  onSelectFile: (path: string) => void
  onOpenRecentFile: (path: string) => void
  onSave: () => void
  onSaveAs: () => void
  onOpenSettings: () => void
  onAbout: () => void
  onQuit: () => void
}

export function EditorLayout({
  filePath,
  isDirty,
  content,
  workspaceRoot,
  fileTree,
  recentFiles,
  onContentChange,
  onOpenFile,
  onOpenFolder,
  onSelectFile,
  onOpenRecentFile,
  onSave,
  onSaveAs,
  onOpenSettings,
  onAbout,
  onQuit,
}: EditorLayoutProps) {
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const previewRef = useRef<PreviewPaneHandle>(null)

  const fileState = useEditorUiStore((state) => state.getFileState(filePath))
  const setViewMode = useEditorUiStore((state) => state.setViewMode)
  const theme = useEditorUiStore((state) => state.theme)
  const toggleTheme = useEditorUiStore((state) => state.toggleTheme)
  const outlineExpanded = useEditorUiStore((state) => state.outlineExpanded)
  const setOutlineExpanded = useEditorUiStore((state) => state.setOutlineExpanded)

  const viewMode = fileState.viewMode
  const previewHtml = useMarkdownPreview(content, filePath)
  const headings = useMemo(() => parseMarkdownHeadings(content), [content])
  const [activeHeadingId, setActiveHeadingId] = useState<string>()
  const [findReplace, setFindReplace] = useState<{ open: boolean; mode: 'find' | 'replace' }>({
    open: false,
    mode: 'find',
  })

  const showEditor = viewMode === 'editor' || viewMode === 'split'
  const showPreview = viewMode === 'preview' || viewMode === 'split'

  const contentPanelIds = useMemo(() => {
    if (showEditor && showPreview) return ['editor', 'preview']
    if (showEditor) return ['editor']
    return ['preview-full']
  }, [showEditor, showPreview])

  const sidebarLayout = useDefaultLayout({
    id: 'markdown-editor-sidebar-main',
    panelIds: ['sidebar', 'main'],
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

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TitleBar
        theme={theme}
        recentFiles={recentFiles}
        onToggleTheme={toggleTheme}
        onOpenFile={onOpenFile}
        onOpenFolder={onOpenFolder}
        onOpenRecentFile={onOpenRecentFile}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onOpenSettings={onOpenSettings}
        onAbout={onAbout}
        onQuit={onQuit}
      />

      <ResizablePanelGroup
        id="markdown-editor-sidebar-main"
        orientation="horizontal"
        defaultLayout={sidebarLayout.defaultLayout}
        onLayoutChanged={sidebarLayout.onLayoutChanged}
        className="min-h-0 flex-1"
      >
        <ResizablePanel id="sidebar" defaultSize="20%" minSize="14%" maxSize="40%" className="min-w-0">
          <Sidebar
            workspaceRoot={workspaceRoot}
            fileTree={fileTree}
            activeFilePath={filePath}
            headings={headings}
            activeHeadingId={activeHeadingId}
            outlineExpanded={outlineExpanded}
            onOutlineToggle={() => setOutlineExpanded(!outlineExpanded)}
            onOpenFolder={onOpenFolder}
            onSelectFile={onSelectFile}
            onSelectHeading={handleSelectHeading}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel id="main" defaultSize="80%" minSize="45%" className="min-w-0">
          <div className="flex h-full min-h-0 flex-col">
            <FileBreadcrumb
              filePath={filePath}
              isDirty={isDirty}
              trailing={
                <ViewModeToggle
                  mode={viewMode}
                  onChange={(mode) => setViewMode(filePath, mode)}
                />
              }
            />

            <main className="min-h-0 flex-1 bg-editor">
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
                        onClose={() => setFindReplace((state) => ({ ...state, open: false }))}
                      />
                      <MarkdownEditor
                        ref={editorRef}
                        value={content}
                        filePath={filePath}
                        theme={theme}
                        onChange={onContentChange}
                        onScroll={handleEditorScroll}
                      />
                    </div>
                  </ResizablePanel>
                )}

                {showEditor && showPreview && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel id="preview" defaultSize="50%" minSize="28%" className="min-w-0">
                      <PreviewPane
                        ref={previewRef}
                        html={previewHtml}
                        theme={theme}
                        onScroll={handlePreviewScroll}
                        onHeadingActivate={handlePreviewHeadingActivate}
                      />
                    </ResizablePanel>
                  </>
                )}

                {!showEditor && showPreview && (
                  <ResizablePanel id="preview-full" defaultSize="100%" className="min-w-0">
                    <PreviewPane
                      ref={previewRef}
                      html={previewHtml}
                      theme={theme}
                      onScroll={handlePreviewScroll}
                      onHeadingActivate={handlePreviewHeadingActivate}
                    />
                  </ResizablePanel>
                )}
              </ResizablePanelGroup>
            </main>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
