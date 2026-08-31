// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { getCodeBlockTextFromCopyButton } from '@/lib/preview/code-block-copy'
import { enhanceWebDocCodeBlocks } from './web-doc-code-blocks'
import { buildWebDocReaderDocument } from './web-doc-html'

describe('enhanceWebDocCodeBlocks', () => {
  it('react.dev Sandpack pre 识别 javascript', () => {
    const html = `<pre class="sp-cm sp-pristine sp-javascript"><code>function MyButton() {}</code></pre>`
    const enhanced = enhanceWebDocCodeBlocks(html)
    expect(enhanced).toContain('class="code-block-lang">javascript')
  })

  it('为 VuePress 风格 div.language-* > pre > code 注入复制工具栏', () => {
    const html = `<div class="language-bash extra-class"><pre class="language-bash"><code>$ curl -Lo minikube</code></pre></div>`

    const enhanced = enhanceWebDocCodeBlocks(html)
    expect(enhanced).toContain('class="code-block"')
    expect(enhanced).toContain('class="code-block-copy"')
    expect(enhanced).toContain('class="code-block-lang">bash')
    expect(enhanced).toContain('$ curl -Lo minikube')
    expect(enhanced).not.toContain('extra-class')
  })

  it('独立 pre 也会包装', () => {
    const html = `<pre><code>plain block</code></pre>`
    const enhanced = enhanceWebDocCodeBlocks(html)
    expect(enhanced).toContain('class="code-block-copy"')
    expect(enhanced).toContain('plain block')
  })

  it('已增强的块不会重复包装', () => {
    const once = enhanceWebDocCodeBlocks(`<pre><code>a</code></pre>`)
    const twice = enhanceWebDocCodeBlocks(once)
    expect(twice.match(/class="code-block-copy"/g)).toHaveLength(1)
  })

  it('复制按钮能读到高亮 span 内的纯文本', () => {
    const enhanced = enhanceWebDocCodeBlocks(
      `<pre class="language-bash"><code>$ <span class="token function">curl</span> minikube</code></pre>`,
    )
    document.body.innerHTML = enhanced
    const button = document.querySelector('.code-block-copy')!
    expect(getCodeBlockTextFromCopyButton(button)).toBe('$ curl minikube')
    document.body.innerHTML = ''
  })
})

describe('buildWebDocReaderDocument', () => {
  it('输出文档含代码块样式与复制按钮', () => {
    const doc = buildWebDocReaderDocument(
      {
        title: 'Demo',
        bodyHtml: `<div class="language-bash"><pre class="language-bash"><code>echo hi</code></pre></div>`,
      },
      'dark',
    )

    expect(doc).toContain('code-block-copy')
    expect(doc).toContain('.code-block-toolbar')
    expect(doc).toContain('echo hi')
  })
})
