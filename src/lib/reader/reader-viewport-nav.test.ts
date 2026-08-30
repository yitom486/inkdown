// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import {
  isHeadingLabelMatch,
  findFlatIndexFromViewport,
  findHeadingElementByLabel,
  findBlockElementByLabel,
  findViewportEntryAnchor,
  normalizeLoadKey,
  scrollToViewportEntry,
  type ViewportNavEntry,
} from '@/lib/reader/reader-viewport-nav'
import { flattenEpubToc } from '@/lib/reader/epub-navigation'
import {
  buildEpubViewportEntries,
  buildMobiViewportEntries,
  findEpubFlatIndexFromViewport,
  findMobiFlatIndexFromViewport,
  MOBI_ANCHOR_TOP_OFFSET,
  scrollMobiChapterToFlatIndex,
} from '@/lib/reader/epub-scroll-toc'
import type { MobiChapterItem } from '@/lib/reader/mobi-navigation'
import { syncEpubNavigationFromViewport, syncMobiNavigationFromViewport } from '@/lib/reader/reader-navigation-sync'

import { mockRelativeOffsetTop, mockScrollDocument, mockScrollRoot } from '@/lib/reader/reader-viewport-test-helpers'
describe('isHeadingLabelMatch', () => {
  it('短标签「小结」不得模糊匹配「讨论与小结」', () => {
    expect(isHeadingLabelMatch('小结', '讨论与小结')).toBe(false)
    expect(isHeadingLabelMatch('小结', '小结')).toBe(true)
  })

  it('章标题允许包含匹配', () => {
    expect(
      isHeadingLabelMatch(
        '第三章 从铲除鳌拜到《尼布楚条约》谈判',
        '第三章 从铲除鳌拜到《尼布楚条约》谈判',
      ),
    ).toBe(true)
  })
})

describe('reader-viewport-nav（跨格式）', () => {
  it('热更新期间缺失 loadKey 时不抛出异常', () => {
    expect(normalizeLoadKey(undefined)).toBe('')
    expect(normalizeLoadKey(null)).toBe('')
  })

  describe('EPUB', () => {
    const introChapters = flattenEpubToc([
      { label: '导言', href: 'intro.html#preface' },
      { label: '研究策略', href: 'intro.html#strategy' },
    ])

    it('buildEpubViewportEntries 收集同 spine 全部 TOC 切片', () => {
      const entries = buildEpubViewportEntries(introChapters, 'intro.html')
      expect(entries.map((entry) => entry.label)).toEqual(['导言', '研究策略'])
    })

    it('激活线处可见「第三章」时当前节为第三章而非「小结」', () => {
      const chapters = flattenEpubToc([
        { label: '《尼布楚条约》签订', href: 'ch2.html#treaty' },
        { label: '小结', href: 'ch2.html#summary' },
        { label: '第三章 从铲除鳌拜到《尼布楚条约》谈判', href: 'ch3.html' },
        { label: '小结', href: 'ch3.html#summary' },
        { label: '第四章 内务府的人', href: 'ch4.html' },
      ])

      const document = mockScrollDocument(
        `
          <h2>第三章 从铲除鳌拜到《尼布楚条约》谈判</h2>
          <p>正文…</p>
          <h3 id="summary">小结</h3>
        `,
        [
          { selector: 'h2', top: 0, height: 48 },
          { id: 'summary', top: 5200, height: 40 },
        ],
        0,
      )

      const nav = syncEpubNavigationFromViewport(chapters, document, 'ch3.html')
      expect(nav.current?.label).toContain('第三章')
      expect(nav.current?.label).not.toBe('小结')
    })

    it('滚过导言标题线后才切到研究策略', () => {
      const document = mockScrollDocument(
        `
          <section id="preface"><h2>导言</h2><p>正文</p></section>
          <section id="strategy"><h2>研究策略</h2></section>
        `,
        [
          { id: 'preface', top: 0, height: 1200 },
          { id: 'strategy', top: 1400, height: 40 },
        ],
        1300,
      )

      expect(findEpubFlatIndexFromViewport(introChapters, document, 'intro.html')).toBe(1)
      expect(introChapters[1]?.label).toBe('研究策略')
    })

    it('导言仍在激活线处时保持导言，不因下方 fragment 提前切换', () => {
      const document = mockScrollDocument(
        `
          <h2>导言</h2><p>${'正文。'.repeat(80)}</p>
          <h2 id="strategy">研究策略</h2>
        `,
        [
          { selector: 'h2:first-of-type', top: 0, height: 48 },
          { id: 'strategy', top: 1400, height: 48 },
        ],
        1100,
      )

      expect(findEpubFlatIndexFromViewport(introChapters, document, 'intro.html')).toBe(0)
    })

    it('章首视口时底栏为「第一章」，下一章非同页子节', () => {
      const chapters = flattenEpubToc([
        {
          label: '第一部分 进入清朝权贵圈的西洋人',
          href: 'part1.html',
          subitems: [
            {
              label: '第一章 佟家的奴才',
              href: 'ch1.html',
              subitems: [
                { label: '战场上的俘虏', href: 'ch1.html#prisoners' },
                { label: '康熙母亲的娘家', href: 'ch1.html#family' },
              ],
            },
            { label: '第二章', href: 'ch2.html' },
          ],
        },
      ])

      const document = mockScrollDocument(
        `
          <h1>第一章 佟家的奴才</h1>
          <p>${'正文。'.repeat(40)}</p>
          <h2 id="prisoners">战场上的俘虏</h2>
        `,
        [
          { selector: 'h1', top: 0, height: 48 },
          { id: 'prisoners', top: 400, height: 40 },
        ],
        0,
      )

      const nav = syncEpubNavigationFromViewport(chapters, document, 'ch1.html')
      expect(nav.current?.label).toContain('第一章')
      expect(nav.current?.label).not.toBe('战场上的俘虏')
      expect(nav.next?.label).toBe('第二章')
    })

    it('嵌套容器内标题：offsetTop=0 但 getBoundingClientRect 在视口内仍识别章标题', () => {
      const chapters = flattenEpubToc([
        { label: '第一章 佟家的奴才', href: 'ch1.html' },
        { label: '战场上的俘虏', href: 'ch1.html#prisoners' },
      ])

      const document = mockScrollDocument(
        `
          <div id="wrap"><h1>第一章 佟家的奴才</h1></div>
          <h2 id="prisoners">战场上的俘虏</h2>
        `,
        [
          { id: 'wrap', top: 120, height: 48 },
          { id: 'prisoners', top: 2400, height: 40 },
        ],
        120,
      )
      const h1 = document.querySelector('h1')
      if (h1 instanceof HTMLElement) {
        mockRelativeOffsetTop(h1, 0, 48)
      }

      const nav = syncEpubNavigationFromViewport(chapters, document, 'ch1.html')
      expect(nav.current?.label).toContain('第一章')
      expect(nav.current?.label).not.toBe('战场上的俘虏')
    })
  })

  describe('MOBI / AZW3', () => {
    const chapters: MobiChapterItem[] = [
      { id: '1', label: '导言', level: 1 },
      { id: '1', label: '研究策略', level: 1 },
      { id: '2', label: '第二章', level: 0 },
    ]

    it('buildMobiViewportEntries 按 chapterId 收集切片', () => {
      const entries = buildMobiViewportEntries(chapters, '1')
      expect(entries.map((entry) => entry.label)).toEqual(['导言', '研究策略'])
    })

    it('标题滚过激活线后同步到研究策略', () => {
      const document = mockScrollDocument(
        `<h2>导言</h2><h2>研究策略</h2>`,
        [
          { selector: 'h2:first-of-type', top: 0, height: 600 },
          { selector: 'h2:last-of-type', top: 900, height: 300 },
        ],
        850,
      )

      const nav = syncMobiNavigationFromViewport(chapters, document, '1')
      expect(chapters[nav.flatIndex]?.label).toBe('研究策略')
      expect(nav.current?.label).toBe('导言')
    })

    it('「小结」不得误匹配含小结字样的长标题', () => {
      const entries: ViewportNavEntry[] = [
        { flatIndex: 0, label: '第三章', loadKey: '3' },
        { flatIndex: 1, label: '小结', loadKey: '3' },
      ]

      const document = mockScrollDocument(
        `<h2>第三章 从铲除鳌拜到《尼布楚条约》谈判</h2><h3>本章小结</h3>`,
        [
          { selector: 'h2', top: 0, height: 48 },
          { selector: 'h3', top: 4000, height: 32 },
        ],
        0,
      )

      expect(findFlatIndexFromViewport(document, entries, '3')).toBe(0)
    })

    it('KF8 selector 可定位标题', () => {
      const document = mockScrollDocument(
        `<p id="sec2" class="calibre_2">二、四面其主：安史乱中的王伷</p><p class="calibre_2">正文</p>`,
        [{ id: 'sec2', top: 800, height: 40 }],
        0,
      )

      const entry: ViewportNavEntry = {
        flatIndex: 2,
        label: '二、四面其主：安史乱中的王伷',
        loadKey: 'chapter2',
        selector: '#sec2',
      }

      expect(findViewportEntryAnchor(document, entry)?.id).toBe('sec2')
      expect(scrollToViewportEntry(document, entry, { behavior: 'auto' })).toBe(true)
    })

    it('calibre 段落标题可按标签文本定位', () => {
      const document = mockScrollDocument(
        `<p class="calibre_5">一、赵晔：《忠义传》中的“贰臣”</p>`,
        [{ selector: 'p.calibre_5', top: 120, height: 36 }],
        0,
      )

      expect(
        findHeadingElementByLabel(document, '一、赵晔：《忠义传》中的“贰臣”')?.className,
      ).toContain('calibre_5')
    })

    it('三级目录项：普通段落文本也可作锚点', () => {
      const document = mockScrollDocument(
        `<p class="calibre_4">三、金土相克：安禄山起兵的政治宣传</p><p>正文段落</p>`,
        [{ selector: 'p.calibre_4', top: 2400, height: 36 }],
        0,
      )

      const entry: ViewportNavEntry = {
        flatIndex: 4,
        label: '三、金土相克：安禄山起兵的政治宣传',
        loadKey: '2',
      }

      expect(findBlockElementByLabel(document, entry.label)?.textContent).toContain('三、金土相克')
      expect(scrollToViewportEntry(document, entry, { behavior: 'auto' })).toBe(true)
    })

    it('AZW3 章内跳转后在标题上方保留可见距离', () => {
      const document = mockScrollDocument(
        '<p id="section" class="calibre_4">二、四星聚与玄宗朝的佛道之争</p>',
        [{ id: 'section', top: 1200, height: 40 }],
        0,
      )
      const scrollRoot = (document.scrollingElement ?? document.documentElement) as HTMLElement
      const scrollTo = vi.fn()
      Object.defineProperty(scrollRoot, 'scrollTo', { configurable: true, value: scrollTo })
      const mobiChapters: MobiChapterItem[] = [
        {
          id: '2',
          label: '二、四星聚与玄宗朝的佛道之争',
          level: 1,
          selector: '#section',
        },
      ]

      expect(scrollMobiChapterToFlatIndex(document, mobiChapters, 0, { behavior: 'auto' })).toBe(true)
      expect(scrollTo).toHaveBeenLastCalledWith({
        top: 1200 - MOBI_ANCHOR_TOP_OFFSET,
        behavior: 'auto',
      })
    })

    it('iframe 文档中的标题不会被父窗口 HTMLElement 判断误杀', () => {
      const frameDocument = mockScrollDocument(
        '<p id="subsection" class="calibre_4">四、严复的死亡与哀荣</p>',
        [{ id: 'subsection', top: 800, height: 40 }],
        0,
      )
      const element = frameDocument.getElementById('subsection')
      expect(element).not.toBeNull()
      if (!element) return

      const frameHTMLElement = HTMLElement
      Object.defineProperty(element, 'ownerDocument', {
        configurable: true,
        value: { defaultView: { HTMLElement: frameHTMLElement } },
      })
      vi.stubGlobal('HTMLElement', class ParentHTMLElement {})

      const entry: ViewportNavEntry = {
        flatIndex: 8,
        label: '四、严复的死亡与哀荣',
        loadKey: '2',
        selector: '#subsection',
      }

      try {
        expect(element instanceof HTMLElement).toBe(false)
        expect(findViewportEntryAnchor(frameDocument, entry)?.id).toBe('subsection')
      } finally {
        vi.unstubAllGlobals()
      }
    })
  })
})
