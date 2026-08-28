import { TitleBar } from '@/components/layout/TitleBar'
import { FileExplorer } from '@/components/layout/FileExplorer'
import { FileBreadcrumb } from '@/components/layout/FileBreadcrumb'
import { MarkdownEditor } from '@/components/editor/MarkdownEditor'
import { PreviewPane } from '@/components/preview/PreviewPane'
import { SplitPane } from '@/components/layout/SplitPane'
import { useMarkdownPreview } from '@/hooks/useMarkdownPreview'
import type { FileTreeNode } from '@/hooks/useFileOperations'

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
  const previewHtml = useMarkdownPreview(content)

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

      <div className="flex min-h-0 flex-1">
        <FileExplorer
          workspaceRoot={workspaceRoot}
          tree={fileTree}
          activeFilePath={filePath}
          onOpenFolder={onOpenFolder}
          onSelectFile={onSelectFile}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <FileBreadcrumb filePath={filePath} isDirty={isDirty} />
          <main className="min-h-0 flex-1 bg-editor">
            <SplitPane
              left={<MarkdownEditor value={content} onChange={onContentChange} />}
              right={<PreviewPane html={previewHtml} />}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
