// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { extractWebDocArticle } from '../web-doc-html'

describe('people-daily layout pages', () => {
  const pageUrl = 'https://paper.people.com.cn/rmrb/pc/layout/202609/01/node_03.html'

  it('版面索引页提取标题、版面导航与本版新闻', () => {
    const html = `<!DOCTYPE html><html><head><title>人民日报-人民网</title></head><body>
      <div class="main w1000">
        <div class="left paper-box"><img usemap="#m" src="paper.jpg" /></div>
        <div class="paper-bot"><p class="ban">第03版：特别报道</p></div>
        <div class="right right-main">
          <div class="swiper-box">
            <div class="swiper-slide"><a href="node_01.html">01版：要闻</a></div>
            <div class="swiper-slide"><a href="node_03.html">03版：特别报道</a></div>
          </div>
          <ul class="news-list">
            <li><a href="../../../content/202609/01/content_30178378.html">李强主持召开国务院常务会议</a></li>
            <li><a href="../../../content/202609/01/content_30178379.html">携手共创埃中两国人民及全人类更加繁荣未来</a></li>
          </ul>
        </div>
      </div>
    </body></html>`

    const result = extractWebDocArticle(html, pageUrl, 'people-daily-paper')

    expect(result.title).toBe('第03版：特别报道')
    expect(result.bodyHtml).toContain('本版新闻')
    expect(result.bodyHtml).toContain('李强主持召开国务院常务会议')
    expect(result.bodyHtml).toContain('node_01.html')
  })
})
