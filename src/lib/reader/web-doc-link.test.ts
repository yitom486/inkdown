// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  INKDOWN_NAV_HREF_ATTR,
  detectWebDocIframeEscape,
  neutralizeWebDocNavigationLinks,
  resolveWebDocClickHref,
  shouldNavigateWebDocInApp,
} from './web-doc-link'

describe('web-doc-link', () => {
  const current =
    'https://paper.people.com.cn/rmrb/pc/content/202609/01/content_30178364.html'

  it('同站链接应在应用内导航', () => {
    expect(
      shouldNavigateWebDocInApp(
        'https://paper.people.com.cn/rmrb/pc/content/202609/01/content_30178365.html',
        current,
      ),
    ).toBe(true)
  })

  it('外站链接应打开外部浏览器', () => {
    expect(shouldNavigateWebDocInApp('https://www.people.com.cn/', current)).toBe(false)
  })

  it('neutralize 将 href 改写为 data 属性', () => {
    const html = neutralizeWebDocNavigationLinks(
      '<a href="node_02.html">02版</a><a href="#top">顶部</a>',
      'https://paper.people.com.cn/rmrb/pc/layout/202609/01/node_03.html',
    )
    const root = document.createElement('div')
    root.innerHTML = html
    const link = root.querySelector('a')
    expect(link?.getAttribute('href')).toBe('#')
    expect(link?.getAttribute(INKDOWN_NAV_HREF_ATTR)).toBe(
      'https://paper.people.com.cn/rmrb/pc/layout/202609/01/node_02.html',
    )
    expect(root.querySelectorAll('a')[1]?.getAttribute('href')).toBe('#top')
  })

  it('detectWebDocIframeEscape 忽略宿主 origin（srcdoc 误报）', () => {
    const iframe = document.createElement('iframe')
    Object.defineProperty(iframe, 'contentWindow', {
      value: { location: { href: 'http://localhost:5173/' } },
    })
    expect(detectWebDocIframeEscape(iframe, 'http://localhost:5173')).toBeNull()
    expect(detectWebDocIframeEscape(iframe, 'http://localhost:5173/')).toBeNull()
  })

  it('解析 data-inkdown-href 链接', () => {
    const anchor = document.createElement('a')
    anchor.setAttribute('href', '#')
    anchor.setAttribute(INKDOWN_NAV_HREF_ATTR, 'https://paper.people.com.cn/rmrb/pc/content/202609/01/content_30178365.html')
    const href = resolveWebDocClickHref(anchor, current)
    expect(href).toBe('https://paper.people.com.cn/rmrb/pc/content/202609/01/content_30178365.html')
  })

  it('解析 area 热区 data 链接', () => {
    const area = document.createElement('area')
    area.setAttribute(INKDOWN_NAV_HREF_ATTR, 'https://paper.people.com.cn/rmrb/pc/content/202609/01/content_30178365.html')
    const href = resolveWebDocClickHref(area, current)
    expect(href).toBe('https://paper.people.com.cn/rmrb/pc/content/202609/01/content_30178365.html')
  })
})
