// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { getCodeBlockTextFromCopyButton } from '@/lib/preview/code-block-copy'
import { activateWebDocCodeTab, enhanceWebDocCodeBlocks } from './web-doc-code-blocks'
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

  it('MkDocs tabbed-set 转为可切换的语言 Tab，默认 Python', () => {
    const html = `
      <div class="tabbed-set tabbed-alternate" data-tabs="1:3">
        <input checked="checked" id="__tabbed_1_1" name="__tabbed_1" type="radio" />
        <input id="__tabbed_1_2" name="__tabbed_1" type="radio" />
        <input id="__tabbed_1_3" name="__tabbed_1" type="radio" />
        <div class="tabbed-labels">
          <label for="__tabbed_1_1">Python</label>
          <label for="__tabbed_1_2">C++</label>
          <label for="__tabbed_1_3">Java</label>
        </div>
        <div class="tabbed-content">
          <div class="tabbed-block">
            <div class="highlight"><span class="filename">a.py</span><pre><code>def f(): pass</code></pre></div>
          </div>
          <div class="tabbed-block">
            <div class="highlight"><span class="filename">a.cpp</span><pre><code>int main(){}</code></pre></div>
          </div>
          <div class="tabbed-block">
            <div class="highlight"><span class="filename">a.java</span><pre><code>class A{}</code></pre></div>
          </div>
        </div>
      </div>`

    const enhanced = enhanceWebDocCodeBlocks(html)
    document.body.innerHTML = enhanced

    expect(enhanced).toContain('web-doc-tabs')
    expect(enhanced).not.toContain('tabbed-set')
    expect(enhanced).not.toContain('PythonC++')
    expect(document.querySelectorAll('[data-web-doc-tab]')).toHaveLength(3)

    const pythonTab = [...document.querySelectorAll('[data-web-doc-tab]')].find(
      (el) => el.textContent === 'Python',
    )!
    const cppTab = [...document.querySelectorAll('[data-web-doc-tab]')].find(
      (el) => el.textContent === 'C++',
    )!
    expect(pythonTab.getAttribute('aria-selected')).toBe('true')
    expect(document.body.textContent).toContain('def f(): pass')
    expect(document.querySelector('[data-tab-index="1"].web-doc-tabs-panel')?.hasAttribute('hidden')).toBe(
      true,
    )

    activateWebDocCodeTab(cppTab)
    expect(cppTab.getAttribute('aria-selected')).toBe('true')
    expect(pythonTab.getAttribute('aria-selected')).toBe('false')
    expect(document.querySelector('[data-tab-index="1"].web-doc-tabs-panel')?.hasAttribute('hidden')).toBe(
      false,
    )
    expect(document.body.textContent).toContain('int main(){}')
    expect(enhanced).toContain('class="code-block-lang">python')

    document.body.innerHTML = ''
  })
})

describe('buildWebDocReaderDocument', () => {
  it('输出文档含代码块样式与复制按钮', () => {
    const doc = buildWebDocReaderDocument(
      {
        title: 'Demo',
        bodyHtml: `<div class="language-bash"><pre class="language-bash"><code>echo hi</code></pre></div>`,
        baseUrl: 'https://example.com/docs',
      },
      'dark',
    )

    expect(doc).toContain('code-block-copy')
    expect(doc).toContain('.code-block-toolbar')
    expect(doc).toContain('echo hi')
    expect(doc).toContain('web-doc-tabs-tab')
  })
})
