// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { ensureWebDocHeadingIds, extractWebDocHeadings, webDocHeadingPlainText } from './web-doc-outline'

describe('web-doc-outline', () => {
  it('抽取标题层级并补齐缺失 id', () => {
    const { bodyHtml, headings } = ensureWebDocHeadingIds(`
      <h1>凤凰架构</h1>
      <p>intro</p>
      <h2 id="deploy">部署环境</h2>
      <h3>容器</h3>
      <h2>部署环境</h2>
    `)

    expect(headings.map((h) => ({ level: h.level, text: h.text, id: h.id }))).toEqual([
      { level: 1, text: '凤凰架构', id: '凤凰架构' },
      { level: 2, text: '部署环境', id: 'deploy' },
      { level: 3, text: '容器', id: '容器' },
      { level: 2, text: '部署环境', id: '部署环境-1' },
    ])
    expect(bodyHtml).toContain('id="凤凰架构"')
    expect(bodyHtml).toContain('id="deploy"')
    expect(bodyHtml).toContain('id="部署环境-1"')
  })

  it('去掉标题锚点链接噪音', () => {
    const doc = new DOMParser().parseFromString(
      `<h2>Quick Start<a class="anchor" href="#quick-start" aria-hidden="true">#</a></h2>`,
      'text/html',
    )
    const h2 = doc.querySelector('h2')!
    expect(webDocHeadingPlainText(h2)).toBe('Quick Start')
  })

  it('extractWebDocHeadings 与 ensure 结果一致', () => {
    const html = '<h1>A</h1><h2>B</h2>'
    expect(extractWebDocHeadings(html)).toEqual(ensureWebDocHeadingIds(html).headings)
  })
})
