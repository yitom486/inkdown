// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  isHeadingLabelMatch,
  findFlatIndexFromViewport,
  type ViewportNavEntry,
} from '@/lib/reader-viewport-nav'
import { flattenEpubToc } from '@/lib/epub-navigation'
import {
  buildEpubViewportEntries,
  buildMobiViewportEntries,
  findEpubFlatIndexFromViewport,
  findMobiFlatIndexFromViewport,
} from '@/lib/epub-scroll-toc'
import type { MobiChapterItem } from '@/lib/mobi-navigation'
import { syncEpubNavigationFromViewport, syncMobiNavigationFromViewport } from '@/lib/reader-navigation-sync'

function mockScrollDocument(
  html: string,
  layout: Array<{ selector?: string; id?: string; top: number; height: number }>,
  scrollTop: number,
): Document {
  const document = window.document
  document.body.innerHTML = html

  const scrollRoot = document.scrollingElement ?? document.documentElement
  Object.defineProperty(scrollRoot, 'clientHeight', { configurable: true, value: 800 })
  Object.defineProperty(scrollRoot, 'scrollTop', { configurable: true, value: scrollTop, writable: true })

  for (const item of layout) {
    const element = item.id
      ? document.getElementById(item.id)
      : item.selector
        ? document.querySelector(item.selector)
        : null
    if (!element || !(element instanceof HTMLElement)) continue
    Object.defineProperty(element, 'offsetTop', { configurable: true, value: item.top })
    Object.defineProperty(element, 'offsetHeight', { configurable: true, value: item.height })
  }

  return document
}

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

    it('滚过导言标题线后才切到研究策略（当前节仍在视口时不误切）', () => {
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

    it('导言仍在激活线处时保持导言，不因底部瞄到研究策略而切换', () => {
      const document = mockScrollDocument(
        `
          <h2>导言</h2><p>${'正文。'.repeat(80)}</p>
          <h2>研究策略</h2>
        `,
        [
          { selector: 'h2:first-of-type', top: 0, height: 48 },
          { selector: 'h2:last-of-type', top: 1400, height: 48 },
        ],
        1100,
      )

      expect(findEpubFlatIndexFromViewport(introChapters, document, 'intro.html')).toBe(0)
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
      expect(nav.current?.label).toBe('研究策略')
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
  })
})
