import { useEffect, useRef, type RefObject } from 'react'
import { hydrateMermaidInElement } from '@/lib/preview/mermaid-hydrate'
import { mermaidLog } from '@/lib/preview/mermaid-debug'
import { useEditorUiStore } from '@/stores/editor-ui-store'

/**
 * 在容器内渲染 `.mermaid` 节点（预览等仍可用）。
 * Agent 气泡已改为独立 AgentMermaidBlock，避免整段 HTML 重灌竞态。
 */
export function useMermaidInContainer(
  containerRef: RefObject<HTMLElement | null>,
  html: string | null,
  enabled: boolean,
): void {
  const theme = useEditorUiStore((s) => s.theme)
  const themeRef = useRef(theme)

  useEffect(() => {
    if (!enabled || !html) {
      mermaidLog('hook:disabled', { enabled, hasHtml: Boolean(html) })
      return
    }
    const preview = containerRef.current
    if (!preview) {
      mermaidLog('hook:no-container')
      return
    }

    const themeChanged = themeRef.current !== theme
    themeRef.current = theme

    let alive = true
    const cancelled = () => !alive

    mermaidLog('hook:effect', {
      theme,
      themeChanged,
      htmlChars: html.length,
    })

    void (async () => {
      try {
        await hydrateMermaidInElement(preview, theme, {
          force: themeChanged,
          cancelled,
          reason: 'preview-hook',
        })
        if (!alive) return
        await hydrateMermaidInElement(preview, theme, {
          force: false,
          cancelled,
          reason: 'preview-hook-retry',
        })
      } catch (error) {
        if (alive) console.error('[mermaid] hook 失败', error)
      }
    })()

    return () => {
      alive = false
      mermaidLog('hook:cleanup')
    }
  }, [containerRef, enabled, html, theme])
}
