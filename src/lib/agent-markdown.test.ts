// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { renderAgentMarkdown, renderAgentMarkdownStreaming } from './agent-markdown'

describe('renderAgentMarkdown', () => {
  it('highlights fenced code with hljs (shared preview pipeline)', () => {
    const html = renderAgentMarkdown(['```ts', 'const answer = 42', '```'].join('\n'))
    expect(html).toContain('code-block-toolbar')
    expect(html).toContain('hljs')
    expect(html).toContain('code-block-copy')
    expect(html).toContain('hljs-number')
  })

  it('keeps mermaid fence for client-side render', () => {
    const html = renderAgentMarkdown(['```mermaid', 'flowchart LR', '  A --> B', '```'].join('\n'))
    expect(html).toContain('class="mermaid"')
    expect(html).toContain('flowchart LR')
  })

  it('preserves sole-root mermaid after sanitize wrap', () => {
    const html = renderAgentMarkdown(['```mermaid', 'graph TD', '  X --> Y', '```'].join('\n'))
    expect(html).toMatch(/<pre[^>]*class="mermaid"/)
  })

  it('closes unclosed fence while streaming', () => {
    const html = renderAgentMarkdownStreaming(['```ts', 'const x = 1'].join('\n'))
    expect(html).toContain('code-block')
    expect(html).toContain('hljs-keyword')
    expect(html).toContain('hljs-number')
  })
})
