// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { getCodeBlockTextFromCopyButton } from './code-block-copy'

describe('getCodeBlockTextFromCopyButton', () => {
  it('reads text from sibling code element', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div class="code-block">
        <button type="button" class="code-block-copy"></button>
        <pre><code>const x = 1</code></pre>
      </div>
    `
    const button = root.querySelector('.code-block-copy')!
    expect(getCodeBlockTextFromCopyButton(button)).toBe('const x = 1')
  })

  it('returns null when code is empty', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div class="code-block">
        <button type="button" class="code-block-copy"></button>
        <pre><code></code></pre>
      </div>
    `
    expect(getCodeBlockTextFromCopyButton(root.querySelector('.code-block-copy')!)).toBeNull()
  })
})
