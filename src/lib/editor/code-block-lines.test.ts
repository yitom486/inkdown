import { describe, expect, it } from 'vitest'
import {
  buildCodeBlockLineNumbers,
  renderCodeBlockLineNumbers,
  wrapHighlightedCodeBlock,
} from './code-block-lines'

describe('code-block-lines', () => {
  it('为单行代码生成行号 1', () => {
    expect(buildCodeBlockLineNumbers('const x = 1')).toEqual(['1'])
  })

  it('为多行代码按行生成行号', () => {
    expect(buildCodeBlockLineNumbers('first\nsecond\nthird')).toEqual(['1', '2', '3'])
  })

  it('忽略末尾空行', () => {
    expect(buildCodeBlockLineNumbers('first\nsecond\n')).toEqual(['1', '2'])
  })

  it('渲染行号 HTML', () => {
    expect(renderCodeBlockLineNumbers('a\nb')).toBe(
      '<span class="code-block-line-number">1</span><span class="code-block-line-number">2</span>',
    )
  })

  it('包装高亮代码为带行号结构', () => {
    const html = wrapHighlightedCodeBlock('a\nb', '<span>a</span>\n<span>b</span>', 'text')

    expect(html).toContain('code-block-body')
    expect(html).toContain('code-block-lines')
    expect(html).toContain('code-block-line-number')
    expect(html).toContain('class="hljs"')
  })
})
