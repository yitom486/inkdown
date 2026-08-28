import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Eye } from 'lucide-react'
import { applyScrollRatio, scrollRatio } from '@/lib/markdown-headings'
import '@/styles/markdown-preview.css'

export interface PreviewPaneHandle {
  scrollToHeading: (id: string) => void
  getScrollRatio: () => number
  setScrollRatio: (ratio: number) => void
  getScrollElement: () => HTMLElement | null
}

interface PreviewPaneProps {
  html: string
  onScroll?: () => void
}

let mermaidInitialized = false

export const PreviewPane = forwardRef<PreviewPaneHandle, PreviewPaneProps>(
  function PreviewPane({ html, onScroll }, ref) {
    const previewRef = useRef<HTMLDivElement>(null)
    const onScrollRef = useRef(onScroll)

    onScrollRef.current = onScroll

    useImperativeHandle(ref, () => ({
      scrollToHeading: (id) => {
        const container = previewRef.current
        if (!container) return

        const heading = container.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
        if (!heading) return

        const top =
          heading.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop -
          16
        container.scrollTop = Math.max(0, top)
      },
      getScrollRatio: () => {
        const container = previewRef.current
        return container ? scrollRatio(container) : 0
      },
      setScrollRatio: (ratio) => {
        const container = previewRef.current
        if (container) applyScrollRatio(container, ratio)
      },
      getScrollElement: () => previewRef.current,
    }))

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

    useEffect(() => {
      const container = previewRef.current
      if (!container) return

      const handleScroll = () => onScrollRef.current?.()
      container.addEventListener('scroll', handleScroll, { passive: true })
      return () => container.removeEventListener('scroll', handleScroll)
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
  },
)
