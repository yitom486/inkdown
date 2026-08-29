// @vitest-environment happy-dom
/**
 * 三格式（EPUB / MOBI / PDF）导航粒度统一回归：
 * - 侧栏 / 视口：展平 TOC flatIndex（含三级小节）
 * - 底栏：与正文渲染一致的章节单位（非三级小节）
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { flattenEpubToc, resolveChapterNav } from '@/lib/epub-navigation'
import { findEpubFlatIndexFromViewport, findMobiFlatIndexFromViewport } from '@/lib/epub-scroll-toc'
import type { MobiChapterItem } from '@/lib/mobi-navigation'
import {
  syncEpubNavigationFromViewport,
  syncMobiNavigationFromViewport,
  syncPdfNavigation,
} from '@/lib/reader-navigation-sync'
import type { ReaderUnit } from '@/lib/reader-navigation'
import {
  selectReaderNavTitles,
  useReaderNavigationStore,
} from '@/stores/reader-navigation-store'

import { mockScrollDocument, mockScrollRoot } from '@/lib/reader-viewport-test-helpers'

/** 康熙红票类：嵌套 TOC，底栏为二级章节 */
const KANGXI_CHAPTER_SCENARIO = {
  epub: () =>
    flattenEpubToc([
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
    ]),
  mobi: (): MobiChapterItem[] => [
    { id: '1', label: '第一部分 进入清朝权贵圈的西洋人', level: 0 },
    { id: '2', label: '第一章 佟家的奴才', level: 0 },
    { id: '2', label: '战场上的俘虏', level: 1 },
    { id: '2', label: '康熙母亲的娘家', level: 1 },
    { id: '3', label: '第二章', level: 0 },
  ],
  pdf: (): ReaderUnit[] => [
    { label: '第一部分 进入清朝权贵圈的西洋人', href: '5', level: 0 },
    { label: '第一章 佟家的奴才', href: '12', level: 0 },
    { label: '战场上的俘虏', href: '13', level: 1 },
    { label: '康熙母亲的娘家', href: '14', level: 1 },
    { label: '第二章', href: '20', level: 0 },
  ],
  chapterFlatIndex: 1,
  chapterTitleFragment: '第一章',
  subsectionTitle: '战场上的俘虏',
  nextChapterTitle: '第二章',
}

describe('阅读器导航粒度统一（EPUB / MOBI / PDF）', () => {
  beforeEach(() => {
    useReaderNavigationStore.getState().beginSession('/books/test', 'epub')
  })

  describe('章首视口：底栏为章标题，非同页子节', () => {
    it('EPUB', () => {
      const chapters = KANGXI_CHAPTER_SCENARIO.epub()
      const document = mockScrollDocument(
        `<h1>第一章 佟家的奴才</h1><p>${'正文。'.repeat(20)}</p><h2 id="prisoners">战场上的俘虏</h2>`,
        [
          { selector: 'h1', top: 0, height: 48 },
          { id: 'prisoners', top: 400, height: 40 },
        ],
        0,
      )

      const nav = syncEpubNavigationFromViewport(chapters, document, 'ch1.html')
      expect(nav.current?.label).toContain(KANGXI_CHAPTER_SCENARIO.chapterTitleFragment)
      expect(nav.current?.label).not.toBe(KANGXI_CHAPTER_SCENARIO.subsectionTitle)
      expect(nav.next?.label).toBe(KANGXI_CHAPTER_SCENARIO.nextChapterTitle)
    })

    it('MOBI / AZW3', () => {
      const chapters = KANGXI_CHAPTER_SCENARIO.mobi()
      const document = mockScrollDocument(
        `<h1>第一章 佟家的奴才</h1><p>${'正文。'.repeat(20)}</p><h2>战场上的俘虏</h2>`,
        [
          { selector: 'h1', top: 0, height: 48 },
          { selector: 'h2', top: 400, height: 40 },
        ],
        0,
      )

      const nav = syncMobiNavigationFromViewport(chapters, document, '2')
      expect(nav.current?.label).toContain(KANGXI_CHAPTER_SCENARIO.chapterTitleFragment)
      expect(nav.current?.label).not.toBe(KANGXI_CHAPTER_SCENARIO.subsectionTitle)
      expect(nav.next?.label).toBe(KANGXI_CHAPTER_SCENARIO.nextChapterTitle)
    })

    it('PDF：底栏按章节点步进，非子节页', () => {
      const outline = KANGXI_CHAPTER_SCENARIO.pdf()
      const nav = syncPdfNavigation(outline, undefined, KANGXI_CHAPTER_SCENARIO.chapterFlatIndex)
      expect(nav.current?.label).toContain(KANGXI_CHAPTER_SCENARIO.chapterTitleFragment)
      expect(nav.next?.label).toBe(KANGXI_CHAPTER_SCENARIO.nextChapterTitle)
    })
  })

  describe('resolveChapterNav：三级小节位置回溯到二级章节', () => {
    it('EPUB 嵌套 TOC', () => {
      const chapters = KANGXI_CHAPTER_SCENARIO.epub()
      const subsectionIndex = chapters.findIndex((c) => c.label === '战场上的俘虏')
      const nav = resolveChapterNav(chapters, undefined, subsectionIndex)
      expect(nav.current?.label).toContain('第一章')
      expect(nav.next?.label).toBe('第二章')
      expect(nav.previous?.label).toContain('第一部分')
    })
  })

  describe('用户 intent：加载/滚动不得立即覆盖 flatIndex', () => {
    it('EPUB syncFlatIndex + 视口误报子节', () => {
      const chapters = KANGXI_CHAPTER_SCENARIO.epub()
      useReaderNavigationStore.getState().beginSession('/books/kangxi.epub', 'epub')
      useReaderNavigationStore.getState().setUnits(chapters)
      useReaderNavigationStore.getState().syncFlatIndex(KANGXI_CHAPTER_SCENARIO.chapterFlatIndex)

      const document = mockScrollDocument(
        `<h2 id="prisoners">战场上的俘虏</h2>`,
        [{ id: 'prisoners', top: 0, height: 40 }],
        0,
      )
      useReaderNavigationStore.getState().syncEpubViewport(chapters, document, 'ch1.html')

      expect(useReaderNavigationStore.getState().nav.current?.label).toContain('第一章')
      expect(useReaderNavigationStore.getState().navIntent?.flatIndex).toBe(1)
    })

    it('MOBI syncFlatIndex + 视口误报子节', () => {
      const chapters = KANGXI_CHAPTER_SCENARIO.mobi()
      useReaderNavigationStore.getState().beginSession('/books/kangxi.mobi', 'mobi')
      useReaderNavigationStore.getState().setUnits(chapters)
      useReaderNavigationStore.getState().syncFlatIndex(KANGXI_CHAPTER_SCENARIO.chapterFlatIndex)

      const document = mockScrollDocument(
        `<h2>战场上的俘虏</h2>`,
        [{ selector: 'h2', top: 0, height: 40 }],
        0,
      )
      useReaderNavigationStore.getState().syncMobiViewport(chapters, document, '2')

      expect(useReaderNavigationStore.getState().nav.current?.label).toContain('第一章')
      expect(useReaderNavigationStore.getState().navIntent?.flatIndex).toBe(1)
    })

    it('PDF syncFlatIndex + 页码滚动误切子节页', () => {
      const outline = KANGXI_CHAPTER_SCENARIO.pdf()
      useReaderNavigationStore.getState().beginSession('/books/kangxi.pdf', 'pdf')
      useReaderNavigationStore.getState().setUnits(outline)
      useReaderNavigationStore.getState().syncFlatIndex(KANGXI_CHAPTER_SCENARIO.chapterFlatIndex)

      useReaderNavigationStore.getState().syncPdf(outline, 13)

      expect(useReaderNavigationStore.getState().nav.current?.label).toContain('第一章')
      expect(useReaderNavigationStore.getState().navIntent?.flatIndex).toBe(1)
    })
  })

  describe('工具栏 / 底部 / 侧栏同源（selectReaderNavTitles）', () => {
    it.each([
      ['epub', 'epub', KANGXI_CHAPTER_SCENARIO.epub()],
      ['mobi', 'mobi', KANGXI_CHAPTER_SCENARIO.mobi()],
      ['pdf', 'pdf', KANGXI_CHAPTER_SCENARIO.pdf()],
    ] as const)('%s', (_label, format, units) => {
      useReaderNavigationStore.getState().beginSession(`/books/test.${format}`, format)
      useReaderNavigationStore.getState().setUnits(units)
      useReaderNavigationStore.getState().syncFlatIndex(KANGXI_CHAPTER_SCENARIO.chapterFlatIndex)

      const state = useReaderNavigationStore.getState()
      const titles = selectReaderNavTitles(state)

      expect(titles.currentTitle).toBe(state.nav.current?.label)
      expect(titles.previousTitle).toBe(state.nav.previous?.label ?? '—')
      expect(titles.nextTitle).toBe(state.nav.next?.label ?? '—')
    })
  })

  describe('视口 flatIndex 与底栏章节粒度分离', () => {
    it('EPUB 视口可定位子节，底栏仍显示章', () => {
      const chapters = KANGXI_CHAPTER_SCENARIO.epub()
      const document = mockScrollDocument(
        `<h1>第一章 佟家的奴才</h1><h2 id="prisoners">战场上的俘虏</h2>`,
        [
          { selector: 'h1', top: 0, height: 48 },
          { id: 'prisoners', top: 400, height: 40 },
        ],
        400,
      )

      const flatIndex = findEpubFlatIndexFromViewport(chapters, document, 'ch1.html')
      const nav = syncEpubNavigationFromViewport(chapters, document, 'ch1.html')
      expect(nav.flatIndex).toBe(flatIndex)
      expect(nav.current?.label).toContain('第一章')
      expect(nav.current?.label).not.toBe('战场上的俘虏')
    })

    it('MOBI findMobiFlatIndexFromViewport 与 sync 结果 flatIndex 一致', () => {
      const chapters = KANGXI_CHAPTER_SCENARIO.mobi()
      const document = mockScrollDocument(
        `<h1>第一章 佟家的奴才</h1><h2>战场上的俘虏</h2>`,
        [
          { selector: 'h1', top: 0, height: 48 },
          { selector: 'h2', top: 400, height: 40 },
        ],
        0,
      )

      const flatIndex = findMobiFlatIndexFromViewport(chapters, document, '2')
      const nav = syncMobiNavigationFromViewport(chapters, document, '2')
      expect(nav.flatIndex).toBe(flatIndex)
      expect(flatIndex).toBe(KANGXI_CHAPTER_SCENARIO.chapterFlatIndex)
    })
  })
})
