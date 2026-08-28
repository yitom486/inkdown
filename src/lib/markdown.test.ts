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

  it('为代码块添加语法高亮与工具栏', () => {
    const html = markdownParser.render(['```ts', 'const answer = 42', '```'].join('\n'))

    expect(html).toContain('code-block-toolbar')
    expect(html).toContain('class="hljs"')
    expect(html).toContain('hljs-number')
    expect(html).toContain('code-block-copy')
  })

  it('为代码块添加语言标签与复制按钮', () => {
    const html = markdownParser.render(['```typescript', 'const x = 1', '```'].join('\n'))

    expect(html).toContain('code-block-lang')
    expect(html).toContain('typescript')
    expect(html).toContain('aria-label="复制代码"')
  })

  it('渲染 GFM 表格', () => {
    const html = markdownParser.render(
      ['| 列 A | 列 B |', '| --- | --- |', '| 1 | 2 |'].join('\n'),
    )

    expect(html).toContain('<table')
    expect(html).toContain('<th')
    expect(html).toContain('列 A')
  })

  it('渲染 GFM 任务列表', () => {
    const html = markdownParser.render(['- [x] 已完成', '- [ ] 待办'].join('\n'))

    expect(html).toContain('task-list-item')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
  })
})
