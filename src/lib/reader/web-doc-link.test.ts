// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { resolveWebDocClickHref, shouldNavigateWebDocInApp } from './web-doc-link'

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

  it('解析 area 热区链接', () => {
    const area = document.createElement('area')
    area.setAttribute('href', 'content_30178365.html')
    const href = resolveWebDocClickHref(area, current)
    expect(href).toBe(
      'https://paper.people.com.cn/rmrb/pc/content/202609/01/content_30178365.html',
    )
  })
})
