import { Button } from '@/components/ui/button'
import { MarkdownEditor } from '@/components/editor/MarkdownEditor'
import { PreviewPane } from '@/components/preview/PreviewPane'
import { SplitPane } from '@/components/layout/SplitPane'
import { useMarkdownPreview } from '@/hooks/useMarkdownPreview'

interface EditorLayoutProps {
  fileName: string
  isDirty: boolean
  content: string
  onContentChange: (value: string) => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onAbout: () => void
}

export function EditorLayout({
  fileName,
  isDirty,
  content,
  onContentChange,
  onOpen,
  onSave,
  onSaveAs,
  onAbout,
}: EditorLayoutProps) {
  const previewHtml = useMarkdownPreview(content)

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {fileName}
            {isDirty ? ' *' : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            阶段 3：Markdown 编辑与实时预览
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onOpen}>
            打开
          </Button>
          <Button variant="outline" size="sm" onClick={onSave}>
            保存
          </Button>
          <Button variant="outline" size="sm" onClick={onSaveAs}>
            另存为
          </Button>
          <Button variant="ghost" size="sm" onClick={onAbout}>
            关于
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <SplitPane
          left={<MarkdownEditor value={content} onChange={onContentChange} />}
          right={<PreviewPane html={previewHtml} />}
        />
      </main>
    </div>
  )
}
