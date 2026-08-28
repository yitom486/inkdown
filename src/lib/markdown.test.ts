import { describe, expect, it } from 'vitest'
import { markdownParser } from './markdown'

describe('markdownParser', () => {
  it('渲染行内与块级 KaTeX 公式', () => {
    const inlineHtml = markdownParser.render('质能方程：$E = mc^2$')
    const blockHtml = markdownParser.render('$$\\frac{a}{b}$$')

    expect(inlineHtml).toContain('class="katex"')
    expect(blockHtml).toContain('class="katex-display"')
  })

  it('将 mermaid 代码块标记为待渲染图表', () => {
    const html = markdownParser.render([
      '```mermaid',
      'flowchart LR',
      '  A[编辑] --> B[预览]',
      '```',
    ].join('\n'))

    expect(html).toContain('<pre class="mermaid">')
    expect(html).toContain('flowchart LR')
    expect(html).not.toContain('language-mermaid')
  })

  it('保留普通代码块的默认渲染', () => {
    const html = markdownParser.render([
      '```ts',
      'const answer = 42',
      '```',
    ].join('\n'))

    expect(html).toContain('<code class="language-ts">')
    expect(html).toContain('const answer = 42')
  })

  it('为代码块添加语言标签与复制按钮', () => {
    const html = markdownParser.render(['```typescript', 'const x = 1', '```'].join('\n'))

    expect(html).toContain('code-block-toolbar')
    expect(html).toContain('code-block-lang')
    expect(html).toContain('typescript')
    expect(html).toContain('code-block-copy')
    expect(html).toContain('aria-label="复制代码"')
  })
})
