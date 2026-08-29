import { useMemo } from 'react'
import { MermaidBlock } from '@/components/markdown/MermaidBlock'
import { splitMarkdownParts } from '@/lib/markdown-parts'
import { cn } from '@/lib/utils'

interface MarkdownContentProps {
  html: string
  className?: string
  /** 为 true 时不拆 Mermaid（流式中间态），整段 HTML 直出 */
  deferMermaid?: boolean
}

/**
 * 预览与 Agent 共用的 Markdown DOM 渲染：
 * 拆出 mermaid → 独立块出图；其余片段 dangerouslySetInnerHTML。
 */
export function MarkdownContent({ html, className, deferMermaid = false }: MarkdownContentProps) {
  const parts = useMemo(() => {
    if (!html || deferMermaid) return null
    return splitMarkdownParts(html)
  }, [html, deferMermaid])

  if (!html) return null

  if (!parts) {
    return (
      <div
        className={cn('min-w-0 max-w-full', className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <div className={cn('min-w-0 max-w-full', className)}>
      {parts.map((part, index) =>
        part.type === 'mermaid' ? (
          <MermaidBlock key={part.id} source={part.source} />
        ) : (
          <div
            key={`html-${index}`}
            className="min-w-0 max-w-full"
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        ),
      )}
    </div>
  )
}
