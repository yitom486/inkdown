// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  extractDocumentTitle,
  extractWebDocArticle,
  rewriteRelativeUrls,
  sanitizeWebDocBodyHtml,
} from './web-doc-html'

describe('web-doc-html', () => {
  it('优先从 article 提取正文并改写相对链接', () => {
    const html = `<!DOCTYPE html><html><head><title>Site</title></head><body>
      <nav>skip</nav>
      <article>
        <h1>Hello React</h1>
        <p>See <a href="/learn">learn</a> and <img src="/icon.png" alt="icon" /></p>
      </article>
    </body></html>`

    const result = extractWebDocArticle(html, 'https://react.dev/learn')
    expect(result.title).toBe('Hello React')
    expect(result.bodyHtml).toContain('https://react.dev/learn')
    expect(result.bodyHtml).toContain('https://react.dev/icon.png')
    expect(result.bodyHtml).not.toContain('<nav')
  })

  it('无 article 时回退 main 或 body', () => {
    const html = `<html><head><title>Fallback</title></head><body><main><p>Body text</p></main></body></html>`
    const result = extractWebDocArticle(html, 'https://example.com/docs')
    expect(extractDocumentTitle(new DOMParser().parseFromString(html, 'text/html'))).toBe('Fallback')
    expect(result.bodyHtml).toContain('Body text')
  })

  it('消毒时移除 script', () => {
    const sanitized = sanitizeWebDocBodyHtml('<p>ok</p><script>alert(1)</script>')
    expect(sanitized).toContain('ok')
    expect(sanitized).not.toContain('script')
  })

  it('rewriteRelativeUrls 保留 hash 链接', () => {
    const root = document.createElement('div')
    root.innerHTML = '<a href="#intro">intro</a>'
    rewriteRelativeUrls(root, 'https://react.dev/learn')
    expect(root.querySelector('a')?.getAttribute('href')).toBe('#intro')
  })
})
