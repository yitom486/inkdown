import { useEffect, useRef } from 'react'
import { Eye } from 'lucide-react'
import '@/styles/markdown-preview.css'

interface PreviewPaneProps {
  html: string
}

let mermaidInitialized = false

export function PreviewPane({ html }: PreviewPaneProps) {
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const preview = previewRef.current
    if (!preview || !html) return

    const diagrams = preview.querySelectorAll<HTMLElement>('.mermaid')
    if (diagrams.length === 0) return

    let cancelled = false

    const renderDiagrams = async (): Promise<void> => {
      try {
        const { default: mermaid } = await import('mermaid')
        if (cancelled) return

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'dark',
          })
          mermaidInitialized = true
        }

        await mermaid.run({ nodes: diagrams, suppressErrors: true })
      } catch (error) {
        console.error('Mermaid 图表渲染失败：', error)
      }
    }

    void renderDiagrams()

    return () => {
      cancelled = true
    }
  }, [html])

  if (!html) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-preview p-6 text-center">
        <Eye className="size-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">在此预览 Markdown 渲染效果</p>
      </div>
    )
  }

  return (
    <div
      ref={previewRef}
      className="markdown-preview h-full overflow-auto bg-preview p-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
