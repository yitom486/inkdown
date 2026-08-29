import { useEffect, useId, useRef } from 'react'
import { hydrateMermaidInElement } from '@/lib/mermaid-hydrate'
import { mermaidLog, mermaidWarn, summarizeMermaidSource } from '@/lib/mermaid-debug'
import { cn } from '@/lib/utils'
import { useEditorUiStore } from '@/stores/editor-ui-store'

interface AgentMermaidBlockProps {
  source: string
  className?: string
}

/**
 * 独立 Mermaid 块：不走父级 dangerouslySetInnerHTML，避免重渲冲掉 SVG。
 */
export function AgentMermaidBlock({ source, className }: AgentMermaidBlockProps) {
  const theme = useEditorUiStore((s) => s.theme)
  const hostRef = useRef<HTMLDivElement>(null)
  const reactId = useId().replace(/:/g, '')
  const effectGen = useRef(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      mermaidWarn('block:no-host', { reactId })
      return
    }

    const gen = ++effectGen.current
    let alive = true

    mermaidLog(`block:effect-start gen=${gen}`, {
      reactId,
      theme,
      ...summarizeMermaidSource(source),
    })

    host.setAttribute('data-mermaid-source', source)
    host.classList.add('mermaid')
    if (!host.querySelector('svg')) {
      host.textContent = source
    }

    void hydrateMermaidInElement(host, theme, {
      force: true,
      reason: `block:${reactId}:g${gen}`,
      cancelled: () => !alive,
    }).then(() => {
      if (!alive) {
        mermaidWarn(`block:effect-finished-stale gen=${gen}`, { reactId })
        return
      }
      mermaidLog(`block:effect-done gen=${gen}`, {
        reactId,
        hasSvg: Boolean(host.querySelector('svg')),
        childCount: host.childNodes.length,
      })
    })

    return () => {
      alive = false
      mermaidWarn(`block:effect-cleanup gen=${gen}`, { reactId })
    }
  }, [source, theme, reactId])

  return (
    <div
      ref={hostRef}
      className={cn('mermaid agent-mermaid-block', className)}
      data-mermaid-source={source}
      data-testid="agent-mermaid-block"
    />
  )
}
