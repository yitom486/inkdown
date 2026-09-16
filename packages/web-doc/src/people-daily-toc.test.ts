import { describe, expect, it } from 'vitest'
import { extractPeopleDailyToc } from './people-daily-toc'

describe('extractPeopleDailyToc', () => {
  it('从本版新闻列表提取文章链接', () => {
    const html = `<html><body>
      <ul class="news-list">
        <li><a href="content_30178364.html"> 习近平同吉尔吉斯斯坦总统扎帕罗夫会谈 </a></li>
        <li><a href="content_30178365.html"> 风雨同舟七十载 </a></li>
      </ul>
      <a href="http://paper.people.com.cn/rmrb/paperindex.htm">首页</a>
    </body></html>`
    const base = 'https://paper.people.com.cn/rmrb/pc/content/202609/01/content_30178364.html'
    const entries = extractPeopleDailyToc(html, base)

    expect(entries).toHaveLength(2)
    expect(entries[0]?.href).toBe(
      'https://paper.people.com.cn/rmrb/pc/content/202609/01/content_30178364.html',
    )
    expect(entries[1]?.label).toContain('风雨同舟')
    expect(entries.every((e) => e.href.includes('content_'))).toBe(true)
  })

  it('无本版新闻时返回空列表', () => {
    const entries = extractPeopleDailyToc('<html><body><a href="/x">x</a></body></html>', 'https://paper.people.com.cn/a.html')
    expect(entries).toEqual([])
  })
})
