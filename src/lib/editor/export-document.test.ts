// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { buildExportHtml, getSuggestedExportName } from './export-document'

vi.mock('@/api/file-api', () => ({
  fileApi: {
    readImage: vi.fn(),
  },
}))

describe('getSuggestedExportName', () => {
  it('无文件路径时使用默认名', () => {
    expect(getSuggestedExportName(undefined, 'pdf')).toBe('export.pdf')
    expect(getSuggestedExportName(undefined, 'html')).toBe('export.html')
  })

  it('从源文件路径推导导出文件名', () => {
    expect(getSuggestedExportName('D:\\docs\\notes\\readme.md', 'pdf')).toBe('readme.pdf')
    expect(getSuggestedExportName('/tmp/report.markdown', 'html')).toBe('report.html')
  })
})

describe('buildExportHtml', () => {
  it('将 Markdown 渲染为完整 HTML 文档', async () => {
    const html = await buildExportHtml(
      ['```ts', 'const answer = 42', '```', '', '**bold** text'].join('\n'),
      'D:\\docs\\readme.md',
    )

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<article class="markdown-preview">')
    expect(html).toContain('code-block-toolbar')
    expect(html).toContain('code-block-lang')
    expect(html).not.toContain('aria-label="复制代码"')
    expect(html).not.toMatch(/<button\b[^>]*code-block-copy/)
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<title>readme.md</title>')
    expect(html).toContain('Microsoft YaHei')
    expect(html).toContain('hljs-keyword')
    expect(html).toContain('@page')
  })

  it('未提供文件路径时使用默认标题', async () => {
    const html = await buildExportHtml('plain text')

    expect(html).toContain('<title>Markdown Export</title>')
  })

  it('消毒危险脚本，避免 XSS 进入导出 HTML', async () => {
    const html = await buildExportHtml('<script>alert(1)</script>\n\n# Safe', 'note.md')

    expect(html).not.toContain('<script>')
    expect(html).toContain('Safe')
  })
})
