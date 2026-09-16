// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { isAllowedWebDocEmbedUrl } from './web-doc-embeds'
import { extractWebDocArticle, sanitizeWebDocBodyHtml } from './web-doc-html'

describe('web-doc embeds', () => {
  it('仅允许 https Python Tutor 域名', () => {
    expect(
      isAllowedWebDocEmbedUrl('https://pythontutor.com/iframe-embed.html#code=print(1)'),
    ).toBe(true)
    expect(isAllowedWebDocEmbedUrl('https://evil.com/x')).toBe(false)
    expect(isAllowedWebDocEmbedUrl('http://pythontutor.com/x')).toBe(false)
  })

  it('保留可视化运行 iframe，去掉任意第三方 iframe', () => {
    const html = `<!DOCTYPE html><html><body><article>
      <details class="pythontutor">
        <summary>可视化运行</summary>
        <iframe class="pythontutor-iframe"
          src="https://pythontutor.com/iframe-embed.html#code=print(1)"></iframe>
      </details>
      <iframe src="https://evil.example/track"></iframe>
      <p>正文</p>
    </article></body></html>`

    const result = extractWebDocArticle(html, 'https://www.hello-algo.com/ch/', 'generic-ssr')
    expect(result.bodyHtml).toContain('可视化运行')
    expect(result.bodyHtml).toContain('pythontutor.com/iframe-embed.html')
    expect(result.bodyHtml).not.toContain('evil.example')
    expect(result.bodyHtml).toContain('正文')
  })

  it('sanitize 后仍拒绝非白名单 iframe', () => {
    const sanitized = sanitizeWebDocBodyHtml(
      `<p>x</p><iframe src="https://attacker.test/a"></iframe>`,
    )
    expect(sanitized).not.toContain('iframe')
    expect(sanitized).toContain('x')
  })
})
