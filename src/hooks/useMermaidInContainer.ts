import { useEffect, type RefObject } from 'react'
import { useEditorUiStore } from '@/stores/editor-ui-store'
import type { AppTheme } from '@/stores/editor-ui-store'

let mermaidInitialized = false
let mermaidTheme: AppTheme = 'dark'

/** 在容器内渲染 `.mermaid` 节点；流式期间应 disabled，结束后再跑 */
export function useMermaidInContainer(
  containerRef: RefObject<HTMLElement | null>,
  html: string | null,
  enabled: boolean,
): void {
  const theme = useEditorUiStore((s) => s.theme)

  useEffect(() => {
    if (!enabled || !html) return
    const preview = containerRef.current
    if (!preview) return

    const diagrams = preview.querySelectorAll<HTMLElement>('.mermaid')
    if (diagrams.length === 0) return

    let cancelled = false

    const run = async () => {
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
        console.error('[agent] Mermaid 渲染失败', error)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [containerRef, enabled, html, theme])
}
