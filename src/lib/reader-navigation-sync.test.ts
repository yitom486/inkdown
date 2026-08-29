// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { flattenEpubToc, findEpubFlatIndex, resolveChapterNav } from '@/lib/epub-navigation'
import { findEpubFlatIndexFromViewport } from '@/lib/epub-scroll-toc'
import type { MobiChapterItem } from '@/lib/mobi-navigation'
import {
  syncEpubNavigation,
  syncEpubNavigationFromRendition,
  syncEpubNavigationFromViewport,
  syncMobiNavigation,
  syncMobiNavigationFromViewport,
  syncPdfNavigation,
} from '@/lib/reader-navigation-sync'
import type { ReaderUnit } from '@/lib/reader-navigation'

function buildGovernanceMonolithicToc() {
  return flattenEpubToc([
    { label: '目录', href: 'nav.xhtml' },
    {
      label: '第一单元',
      href: 'text00002.html',
      subitems: [
        { label: '第2章 国家治理逻辑', href: 'text00002.html#chapter2' },
        { label: '讨论与小结', href: 'text00002.html#summary' },
      ],
    },
    { label: '第3章 控制权理论', href: 'text00003.html' },
    { label: '第4章 治理模式', href: 'text00004.html' },
  ])
}

import { mockRelativeOffsetTop, mockScrollRoot } from '@/lib/reader-viewport-test-helpers'

function buildGovernanceChapterDocument(scrollTop = 0): Document {
  const document = window.document
  document.body.innerHTML = `
    <section id="unit1"><h1>第一单元</h1></section>
    <section id="chapter2"><h2>第2章 国家治理逻辑与中国官僚制</h2><p>正文…</p></section>
    <section id="summary"><h3>讨论与小结</h3><p>小结…</p></section>
  `
  mockScrollRoot(document, scrollTop)
  const scrollRoot = document.scrollingElement as HTMLElement
  for (const [id, top] of [
    ['unit1', 0],
    ['chapter2', 1200],
    ['summary', 4800],
  ] as const) {
    const element = document.getElementById(id)
    if (element instanceof HTMLElement) mockRelativeOffsetTop(element, top, 40)
  }
  return document
}

function mockEpubRendition(document: Document, spineHref: string) {
  return {
    getContents: () => [{ document }],
    currentLocation: () => ({ start: { href: spineHref } }),
  }
}

describe('reader-navigation-sync', () => {
  describe('EPUB scrolled-doc 状态不同步回归', () => {
    const chapters = buildGovernanceMonolithicToc()

    it('视口在第2章时，底栏显示所属单元，下一章为第3章', () => {
      const document = buildGovernanceChapterDocument(900)

      const nav = syncEpubNavigationFromViewport(chapters, document, 'text00002.html')
      expect(nav.current?.label).toBe('第一单元')
      expect(nav.next?.label).toBe('第3章 控制权理论')
    })

    it('全书百分比 hint 与视口不一致时，视口同步优先（防止底部显示讨论与小结）', () => {
      const document = buildGovernanceChapterDocument(900)

      const hintNav = syncEpubNavigation(chapters, {
        href: 'text00002.html',
        percentage: 0.9,
      })
      expect(hintNav.current?.label).toBe('第一单元')
      expect(chapters[hintNav.flatIndex]?.label).toBe('讨论与小结')

      const viewportNav = syncEpubNavigationFromRendition(
        chapters,
        mockEpubRendition(document, 'text00002.html'),
      )
      expect(viewportNav.current?.label).toBe('第一单元')
      expect(chapters[viewportNav.flatIndex]?.label).toBe('第2章 国家治理逻辑')
      expect(chapters[hintNav.flatIndex]?.label).toBe('讨论与小结')
      expect(viewportNav.flatIndex).not.toBe(hintNav.flatIndex)
    })

    it('syncEpubNavigationFromRendition 与 scroll 视口结果一致', () => {
      const document = buildGovernanceChapterDocument(900)

      const fromScroll = syncEpubNavigationFromViewport(chapters, document, 'text00002.html')
      const fromRendition = syncEpubNavigationFromRendition(
        chapters,
        mockEpubRendition(document, 'text00002.html'),
      )

      expect(fromRendition.flatIndex).toBe(fromScroll.flatIndex)
      expect(fromRendition.current?.label).toBe(fromScroll.current?.label)
    })

    it('工具栏/底部/侧栏共用 flatIndex：视口锚点与 resolveChapterNav 一致', () => {
      const document = buildGovernanceChapterDocument(900)

      const flatIndex = findEpubFlatIndexFromViewport(chapters, document, 'text00002.html')
      const nav = resolveChapterNav(chapters, undefined, flatIndex)
      const synced = syncEpubNavigationFromViewport(chapters, document, 'text00002.html')

      expect(synced.flatIndex).toBe(flatIndex)
      expect(synced.current?.label).toBe(nav.current?.label)
      expect(synced.previous?.label).toBe(nav.previous?.label)
      expect(synced.next?.label).toBe(nav.next?.label)
    })

    it('同 HTML 多节：不得仅用 spine href 取最后一条 TOC（旧 findLast 回归）', () => {
      const sameDocIndices = chapters
        .map((chapter, index) => ({ chapter, index }))
        .filter(({ chapter }) => chapter.href.startsWith('text00002.html'))
        .map(({ index }) => index)

      expect(sameDocIndices.length).toBeGreaterThan(1)
      const lastSameDoc = sameDocIndices[sameDocIndices.length - 1]!
      expect(chapters[lastSameDoc]?.label).toBe('讨论与小结')

      const spineOnlyNav = syncEpubNavigation(chapters, { href: 'text00002.html' })
      expect(spineOnlyNav.current?.label).not.toBe('讨论与小结')
      expect(findEpubFlatIndex(chapters, { href: 'text00002.html' })).not.toBe(lastSameDoc)
    })
  })

  describe('三格式统一同步入口', () => {
    it('MOBI 通过 syncMobiNavigation 解析 spine 级底栏', () => {
      const chapters: MobiChapterItem[] = [
        { id: '0', label: '目录', level: 0 },
        { id: '1', label: '第一章', level: 0 },
        { id: '1', label: '一、小引', level: 1 },
        { id: '2', label: '第二章', level: 0 },
      ]

      const nav = syncMobiNavigation(chapters, undefined, 2)
      expect(nav.current?.label).toBe('第一章')
      expect(nav.next?.label).toBe('第二章')
      expect(nav.previous).toBeNull()
    })

    it('PDF 通过 syncPdfNavigation 按页码解析大纲', () => {
      const outline: ReaderUnit[] = [
        { label: '前言', href: '5', level: 0 },
        { label: '第1章', href: '12', level: 0 },
        { label: '第2章', href: '20', level: 0 },
      ]

      const nav = syncPdfNavigation(outline, 12)
      expect(nav.current?.label).toBe('第1章')
      expect(nav.next?.label).toBe('第2章')
    })

    it('MOBI/AZW3 视口同步：滚过导言标题线后显示研究策略', () => {
      const chapters: MobiChapterItem[] = [
        { id: '1', label: '导言', level: 1 },
        { id: '1', label: '研究策略', level: 1 },
      ]

      const document = window.document
      document.body.innerHTML = `<h2>导言</h2><h2>研究策略</h2>`
      mockScrollRoot(document, 900)
      const scrollRoot = document.scrollingElement as HTMLElement
      const headings = document.querySelectorAll('h2')
      mockRelativeOffsetTop(headings[0] as HTMLElement, 0, 600)
      mockRelativeOffsetTop(headings[1] as HTMLElement, 850, 300)

      const nav = syncMobiNavigationFromViewport(chapters, document, '1')
      expect(chapters[nav.flatIndex]?.label).toBe('研究策略')
      expect(nav.current?.label).toBe('导言')
      expect(nav.next).toBeNull()
    })
  })
})
