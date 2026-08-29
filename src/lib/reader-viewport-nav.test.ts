// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { flattenEpubToc } from '@/lib/epub-navigation'
import {
  buildEpubViewportEntries,
  buildMobiViewportEntries,
  findEpubFlatIndexFromViewport,
  findMobiFlatIndexFromViewport,
} from '@/lib/epub-scroll-toc'
import type { MobiChapterItem } from '@/lib/mobi-navigation'
import { findFlatIndexFromViewport } from '@/lib/reader-viewport-nav'
import { syncMobiNavigationFromViewport } from '@/lib/reader-navigation-sync'

function mockScrollDocument(
  html: string,
  layout: Array<{ id: string; top: number; height: number }>,
  scrollTop: number,
): Document {
  const document = window.document
  document.body.innerHTML = html

  const scrollRoot = document.scrollingElement ?? document.documentElement
  Object.defineProperty(scrollRoot, 'clientHeight', { configurable: true, value: 800 })
  Object.defineProperty(scrollRoot, 'scrollTop', { configurable: true, value: scrollTop, writable: true })

  for (const { id, top, height } of layout) {
    const element = document.getElementById(id)
    if (!element) continue
    Object.defineProperty(element, 'offsetTop', { configurable: true, value: top })
    Object.defineProperty(element, 'offsetHeight', { configurable: true, value: height })
  }

  return document
}

describe('reader-viewport-nav（跨格式）', () => {
  describe('EPUB', () => {
    const chapters = flattenEpubToc([
      { label: '导言', href: 'intro.html#preface' },
      { label: '研究策略', href: 'intro.html#strategy' },
    ])

    it('buildEpubViewportEntries 收集同 spine 全部 TOC 切片', () => {
      const entries = buildEpubViewportEntries(chapters, 'intro.html')
      expect(entries.map((entry) => entry.label)).toEqual(['导言', '研究策略'])
    })

    it('下一节标题在视口底部露出时，当前节切到研究策略', () => {
      const document = mockScrollDocument(
        `
          <section id="preface"><h2>导言</h2><p>正文</p></section>
          <section id="strategy"><h2>研究策略</h2></section>
        `,
        [
          { id: 'preface', top: 0, height: 1200 },
          { id: 'strategy', top: 1400, height: 400 },
        ],
        1100,
      )

      expect(findEpubFlatIndexFromViewport(chapters, document, 'intro.html')).toBe(1)
      expect(chapters[1]?.label).toBe('研究策略')
    })
  })

  describe('MOBI / AZW3（同 spine 多 TOC）', () => {
    const chapters: MobiChapterItem[] = [
      { id: '1', label: '导言', level: 1 },
      { id: '1', label: '研究策略', level: 1 },
      { id: '2', label: '第二章', level: 0 },
    ]

    it('buildMobiViewportEntries 按 chapterId 收集切片', () => {
      const entries = buildMobiViewportEntries(chapters, '1')
      expect(entries.map((entry) => entry.label)).toEqual(['导言', '研究策略'])
    })

    it('按标题锚点同步：视口露出研究策略时 flatIndex 指向研究策略', () => {
      const document = mockScrollDocument(
        `
          <h2>导言</h2><p>${'导言正文。'.repeat(80)}</p>
          <h2>研究策略</h2><p>策略正文</p>
        `,
        [
          { id: 'preface', top: 0, height: 1200 },
          { id: 'strategy', top: 1400, height: 400 },
        ],
        1100,
      )

      const headings = document.querySelectorAll('h2')
      Object.defineProperty(headings[0]!, 'offsetTop', { configurable: true, value: 0 })
      Object.defineProperty(headings[0]!, 'offsetHeight', { configurable: true, value: 1200 })
      Object.defineProperty(headings[1]!, 'offsetTop', { configurable: true, value: 1400 })
      Object.defineProperty(headings[1]!, 'offsetHeight', { configurable: true, value: 400 })

      const entries = buildMobiViewportEntries(chapters, '1')
      expect(findFlatIndexFromViewport(document, entries, '1')).toBe(1)

      const nav = syncMobiNavigationFromViewport(chapters, document, '1')
      expect(nav.current?.label).toBe('研究策略')
      expect(nav.previous?.label).toBe('导言')
      expect(nav.next?.label).toBe('第二章')
    })

    it('同 spine 下一节不应依赖重新 loadChapter（flatIndex 不同即可定位）', () => {
      const document = mockScrollDocument(
        `<h2>导言</h2><h2>研究策略</h2>`,
        [
          { id: 'a', top: 0, height: 600 },
          { id: 'b', top: 900, height: 300 },
        ],
        0,
      )
      const headings = document.querySelectorAll('h2')
      Object.defineProperty(headings[0]!, 'offsetTop', { configurable: true, value: 0 })
      Object.defineProperty(headings[0]!, 'offsetHeight', { configurable: true, value: 600 })
      Object.defineProperty(headings[1]!, 'offsetTop', { configurable: true, value: 900 })
      Object.defineProperty(headings[1]!, 'offsetHeight', { configurable: true, value: 300 })

      expect(findMobiFlatIndexFromViewport(chapters, document, '1')).toBe(0)
    })
  })
})
