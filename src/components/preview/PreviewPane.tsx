import '@/styles/markdown-preview.css'

interface PreviewPaneProps {
  html: string
}

export function PreviewPane({ html }: PreviewPaneProps) {
  if (!html) {
    return (
      <div className="markdown-preview markdown-preview-empty flex h-full items-center justify-center p-4 text-sm">
        预览将在此处显示
      </div>
    )
  }

  return (
    <div
      className="markdown-preview h-full overflow-auto p-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
