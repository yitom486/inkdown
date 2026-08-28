import { useCallback, useMemo, useRef, useState } from 'react'
import { useDefaultLayout } from 'react-resizable-panels'
import { TitleBar } from '@/components/layout/TitleBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { FileBreadcrumb } from '@/components/layout/FileBreadcrumb'
import { ViewModeToggle } from '@/components/layout/ViewModeToggle'
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from '@/components/editor/MarkdownEditor'
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
import { useEditorUiStore } from '@/stores/editor-ui-store'
import type { FileTreeNode } from '@shared/file-types'

interface EditorLayoutProps {
  filePath?: string
  isDirty: boolean
  content: string
  workspaceRoot?: string
  fileTree: FileTreeNode[]
  onContentChange: (value: string) => void
  onOpenFile: () => void
  onOpenFolder: () => void
  onSelectFile: (path: string) => void
  onSave: () => void
  onSaveAs: () => void
  onAbout: () => void
  onQuit: () => void
}

export function EditorLayout({
  filePath,
  isDirty,
  content,
  workspaceRoot,
  fileTree,
  onContentChange,
  onOpenFile,
  onOpenFolder,
  onSelectFile,
  onSave,
  onSaveAs,
  onAbout,
  onQuit,
}: EditorLayoutProps) {
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const previewRef = useRef<PreviewPaneHandle>(null)

  const fileState = useEditorUiStore((state) => state.getFileState(filePath))
  const setViewMode = useEditorUiStore((state) => state.setViewMode)
  const outlineExpanded = useEditorUiStore((state) => state.outlineExpanded)
  const setOutlineExpanded = useEditorUiStore((state) => state.setOutlineExpanded)

  const viewMode = fileState.viewMode
  const previewHtml = useMarkdownPreview(content)
  const headings = useMemo(() => parseMarkdownHeadings(content), [content])
  const [activeHeadingId, setActiveHeadingId] = useState<string>()

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
    updateActiveHeading()
  }, [onEditorScroll, updateActiveHeading])

  const handleSelectHeading = useCallback(
    (heading: MarkdownHeading) => {
      jumpToHeading(heading)
      setActiveHeadingId(heading.id)
    },
    [jumpToHeading],
  )

  return (
    <div className="dark flex h-screen flex-col bg-background text-foreground">
      <TitleBar
        onOpenFile={onOpenFile}
        onOpenFolder={onOpenFolder}
        onSave={onSave}
        onSaveAs={onSaveAs}
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
                    <MarkdownEditor
                      ref={editorRef}
                      value={content}
                      filePath={filePath}
                      onChange={onContentChange}
                      onScroll={handleEditorScroll}
                    />
                  </ResizablePanel>
                )}

                {showEditor && showPreview && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel id="preview" defaultSize="50%" minSize="28%" className="min-w-0">
                      <PreviewPane
                        ref={previewRef}
                        html={previewHtml}
                        onScroll={onPreviewScroll}
                      />
                    </ResizablePanel>
                  </>
                )}

                {!showEditor && showPreview && (
                  <ResizablePanel id="preview-full" defaultSize="100%" className="min-w-0">
                    <PreviewPane
                      ref={previewRef}
                      html={previewHtml}
                      onScroll={onPreviewScroll}
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
