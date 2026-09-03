import { describe, expect, it } from 'vitest'
import type { ReadingMark } from '@shared/types/reading-mark'
import {
  buildAnkiCardsExport,
  buildAnkiExportFileName,
  sanitizeAnkiTag,
} from './export-anki-cards'
import {
  tocFromEpubUnits,
  resolveEpubChapter,
} from './export-reading-notes'

function createMark(overrides: Partial<ReadingMark> & Pick<ReadingMark, 'id' | 'kind' | 'anchor'>): ReadingMark {
  return {
    filePath: '/books/Vue-Design.epub',
    fileFingerprint: 'fp',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('export-anki-cards', () => {
  const toc = tocFromEpubUnits([
    { href: 'chap1.xhtml', label: '第1章 框架设计概览' },
    { href: 'chap2.xhtml', label: '第2章 响应系统' },
  ])

  describe('sanitizeAnkiTag', () => {
    it('removes spaces, colons and illegal chars', () => {
      expect(sanitizeAnkiTag('Vue.js 设计与实现：深入')).toBe('Vue.js_设计与实现_深入')
      expect(sanitizeAnkiTag('  tag:123  ')).toBe('tag_123')
    })
  })

  describe('buildAnkiCardsExport', () => {
    const marks: ReadingMark[] = [
      createMark({
        id: 'mark-note',
        kind: 'note',
        note: '什么是响应式系统的核心？',
        excerpt: '响应式系统的核心就是拦截对象属性的读写。',
        anchor: { format: 'epub', cfi: 'cfi-1', href: 'chap2.xhtml' },
      }),
      createMark({
        id: 'mark-hl',
        kind: 'highlight',
        excerpt: '虚拟 DOM 的本质是用 JS 对象来描述真实的 DOM 结构。',
        anchor: { format: 'epub', cfi: 'cfi-2', href: 'chap1.xhtml' },
      }),
      createMark({
        id: 'mark-bm',
        kind: 'bookmark',
        anchor: { format: 'epub', cfi: 'cfi-3', href: 'chap1.xhtml' },
      }),
    ]

    it('generates basic card for mark with note, and cloze card for pure highlight', () => {
      const res = buildAnkiCardsExport({
        marks,
        toc,
        scope: 'book',
        bookTitle: 'Vue.js设计与实现',
        resolveChapter: resolveEpubChapter,
        now: new Date(2026, 8, 3, 14, 0),
      })

      expect(res).not.toBeNull()
      expect(res?.cardCount).toBe(2) // bookmark excluded

      const [clozeCard, basicCard] = res!.cards
      // Sort key order: chap1 comes before chap2
      expect(clozeCard?.kind).toBe('cloze')
      expect(clozeCard?.front).toContain('{{c1::虚拟 DOM 的本质是用 JS 对象来描述真实的 DOM 结构。}}')

      expect(basicCard?.kind).toBe('basic')
      expect(basicCard?.front).toContain('什么是响应式系统的核心？')
      expect(basicCard?.back).toContain('响应式系统的核心就是拦截对象属性的读写。')

      // Content format check
      expect(res?.content).toContain('#separator:tab')
      expect(res?.content).toContain('#html:true')
      expect(res?.content).toContain('#tags column:3')
      expect(res?.content.split('\n')).toHaveLength(5) // header(3) + 2 cards
    })

    it('filters by current chapter when scope is chapter', () => {
      const currentChapter = toc[0]!
      const res = buildAnkiCardsExport({
        marks,
        toc,
        scope: 'chapter',
        currentChapter,
        bookTitle: 'Vue.js设计与实现',
        resolveChapter: resolveEpubChapter,
      })

      expect(res).not.toBeNull()
      expect(res?.cardCount).toBe(1)
      expect(res?.cards[0]?.id).toBe('mark-hl')
    })

    it('returns null when no eligible marks in scope', () => {
      const res = buildAnkiCardsExport({
        marks: [
          createMark({
            id: 'bm-only',
            kind: 'bookmark',
            anchor: { format: 'epub', cfi: 'cfi-9', href: 'chap1.xhtml' },
          }),
        ],
        toc,
        scope: 'book',
        bookTitle: 'Vue',
        resolveChapter: resolveEpubChapter,
      })

      expect(res).toBeNull()
    })
  })

  describe('buildAnkiExportFileName', () => {
    it('builds filenames for book and chapter scopes', () => {
      const now = new Date(2026, 8, 3, 14, 20)
      const bookFile = buildAnkiExportFileName('深入理解Java虚拟机', 'book', null, now)
      expect(bookFile).toBe('深入理解Java虚拟机-anki-20260903-1420.txt')

      const chapFile = buildAnkiExportFileName('深入理解Java虚拟机', 'chapter', '第1章 走近Java', now)
      expect(chapFile).toBe('深入理解Java虚拟机：第1章 走近Java-anki-20260903-1420.txt')
    })
  })
})
