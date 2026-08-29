// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import DOMPurify from 'dompurify'
import { markdownParser } from '@/lib/markdown'
import { PREVIEW_SANITIZE_OPTIONS } from '@/lib/preview-sanitize'

function sanitizePreview(html: string): string {
  // 与 Agent 一致：包一层再消毒，避免 sole-root <pre class="mermaid"> 被剥成纯文本
  return String(DOMPurify.sanitize(`<div>${html}</div>`, PREVIEW_SANITIZE_OPTIONS))
}

describe('markdown preview mermaid sanitize', () => {
  it('keeps sole-root pre.mermaid when wrapped before sanitize', () => {
    const raw = markdownParser.render(
      ['```mermaid', 'flowchart TD', 'A --> B', '```'].join('\n'),
    )
    expect(raw).toContain('class="mermaid"')
    const html = sanitizePreview(raw)
    expect(html).toMatch(/<pre[^>]*class="mermaid"/)
    expect(html).toContain('flowchart TD')
  })

  it('keeps mermaid inside a full document', () => {
    const raw = markdownParser.render(
      [
        '## 4. Mermaid 图表',
        '',
        '```mermaid',
        'flowchart TD',
        'A[打开] --> B{扩展?}',
        '```',
        '',
        '结束',
      ].join('\n'),
    )
    const html = sanitizePreview(raw)
    expect(html).toMatch(/<pre[^>]*class="mermaid"/)
    expect(html).toContain('flowchart TD')
  })
})
