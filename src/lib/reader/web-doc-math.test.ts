// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { enhanceWebDocMath } from './web-doc-math'
import { buildWebDocReaderDocument } from './web-doc-html'

describe('enhanceWebDocMath', () => {
  it('渲染 arithmatex 行内 \\( \\) 公式', () => {
    const html = `<p>每轮选择上<span class="arithmatex">\\(1\\)</span>阶或<span class="arithmatex">\\(2\\)</span>阶</p>`
    const out = enhanceWebDocMath(html)
    expect(out).toContain('class="katex"')
    expect(out).not.toContain('\\(1\\)')
    expect(out).toContain('>1<')
  })

  it('渲染正文残留的 \\( \\) 文本', () => {
    const html = `<p>方案数量加\\(1\\)，越过则剪枝</p>`
    const out = enhanceWebDocMath(html)
    expect(out).toContain('class="katex"')
    expect(out).not.toContain('\\(1\\)')
  })

  it('不改动 pre/code 内的字面量', () => {
    const html = `<pre><code>print("\\(1\\)")</code></pre>`
    const out = enhanceWebDocMath(html)
    expect(out).toContain('\\(1\\)')
    expect(out).not.toContain('class="katex"')
  })
})

describe('buildWebDocReaderDocument math', () => {
  it('文档含 KaTeX 样式与渲染结果', () => {
    const doc = buildWebDocReaderDocument(
      {
        title: 'Demo',
        bodyHtml: `<p><span class="arithmatex">\\(n\\)</span></p>`,
        baseUrl: 'https://example.com/docs',
      },
      'light',
    )
    expect(doc).toContain('katex.min.css')
    expect(doc).toContain('class="katex"')
  })
})
