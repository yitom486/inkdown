import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Eye } from 'lucide-react'
import { toast } from 'sonner'
import githubTheme from 'highlight.js/styles/github.min.css?url'
import githubDarkTheme from 'highlight.js/styles/github-dark.min.css?url'
import { applyScrollRatio, collectPreviewHeadingPositions, scrollRatio } from '@/lib/markdown-headings'
import type { AppTheme } from '@/stores/editor-ui-store'
import '@/styles/markdown-preview.css'

const HIGHLIGHT_THEME_LINK_ID = 'markdown-preview-hljs-theme'

function useHighlightTheme(theme: AppTheme) {
  useEffect(() => {
    let link = document.getElementById(HIGHLIGHT_THEME_LINK_ID) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = HIGHLIGHT_THEME_LINK_ID
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }

    link.href = theme === 'dark' ? githubDarkTheme : githubTheme
  }, [theme])
}

export interface PreviewPaneHandle {
  scrollToHeading: (id: string) => void
  getActiveHeadingId: () => string | undefined
  getScrollRatio: () => number
  setScrollRatio: (ratio: number) => void
  getScrollElement: () => HTMLElement | null
}

interface PreviewPaneProps {
  html: string
  theme?: AppTheme
  onScroll?: () => void
  onHeadingActivate?: (headingId: string) => void
}

let mermaidInitialized = false
let mermaidTheme: AppTheme = 'dark'

export const PreviewPane = forwardRef<PreviewPaneHandle, PreviewPaneProps>(
  function PreviewPane({ html, theme = 'dark', onScroll, onHeadingActivate }, ref) {
    const previewRef = useRef<HTMLDivElement>(null)
    const onScrollRef = useRef(onScroll)
    const onHeadingActivateRef = useRef(onHeadingActivate)

    useHighlightTheme(theme)

    onScrollRef.current = onScroll
    onHeadingActivateRef.current = onHeadingActivate

    const scrollToHeading = (id: string) => {
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
    }

    useImperativeHandle(ref, () => ({
      scrollToHeading,
      getActiveHeadingId: () => {
        const container = previewRef.current
        if (!container) return undefined

        const positions = collectPreviewHeadingPositions(container)
        if (positions.length === 0) return undefined

        const threshold = container.scrollTop + 32
        let activeId: string | undefined

        for (const position of positions) {
          if (position.top <= threshold) {
            activeId = position.id
          } else {
            break
          }
        }

        return activeId
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

          if (!mermaidInitialized || mermaidTheme !== theme) {
            mermaid.initialize({
              startOnLoad: false,
              securityLevel: 'strict',
              theme: theme === 'dark' ? 'dark' : 'neutral',
            })
            mermaidInitialized = true
            mermaidTheme = theme
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
    }, [html, theme])

    useEffect(() => {
      const container = previewRef.current
      if (!container) return

      const handleScroll = () => onScrollRef.current?.()
      container.addEventListener('scroll', handleScroll, { passive: true })
      return () => container.removeEventListener('scroll', handleScroll)
    }, [html])

    useEffect(() => {
      const container = previewRef.current
      if (!container) return

      const handleClick = (event: MouseEvent) => {
        const target = event.target
        if (!(target instanceof Element)) return

        const copyButton = target.closest<HTMLButtonElement>('.code-block-copy')
        if (copyButton) return

        const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]')
        if (anchor) {
          const rawHref = anchor.getAttribute('href')
          if (!rawHref || rawHref === '#') return

          event.preventDefault()
          const headingId = decodeURIComponent(rawHref.slice(1))
          scrollToHeading(headingId)
          onHeadingActivateRef.current?.(headingId)
          return
        }

        const heading = target.closest<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')
        if (heading?.id) {
          onHeadingActivateRef.current?.(heading.id)
        }
      }

      const handleCopy = async (event: MouseEvent) => {
        const target = event.target
        if (!(target instanceof Element)) return

        const button = target.closest<HTMLButtonElement>('.code-block-copy')
        if (!button) return

        const code = button.closest('.code-block')?.querySelector('code')
        const text = code?.textContent
        if (!text) return

        event.preventDefault()
        try {
          await navigator.clipboard.writeText(text)
          button.classList.add('copied')
          button.setAttribute('aria-label', '已复制')
          toast.success('代码已复制')
          window.setTimeout(() => {
            button.classList.remove('copied')
            button.setAttribute('aria-label', '复制代码')
          }, 1500)
        } catch (error) {
          console.error('复制代码失败：', error)
        }
      }

      container.addEventListener('click', handleClick)
      container.addEventListener('click', handleCopy)
      return () => {
        container.removeEventListener('click', handleClick)
        container.removeEventListener('click', handleCopy)
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
        data-theme={theme}
        className="markdown-preview h-full overflow-auto bg-preview p-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  },
)
