import { describe, expect, it } from 'vitest'
import { stripExportChrome } from './export-document-styles'

describe('stripExportChrome', () => {
  it('移除代码块复制按钮', () => {
    const html = [
      '<div class="code-block-toolbar">',
      '<span class="code-block-lang">ts</span>',
      '<button type="button" class="code-block-copy" aria-label="复制代码">x</button>',
      '</div>',
    ].join('')

    const cleaned = stripExportChrome(html)
    expect(cleaned).toContain('code-block-lang')
    expect(cleaned).not.toContain('code-block-copy')
    expect(cleaned).not.toContain('复制代码')
  })
})
