import { describe, expect, it } from 'vitest'
import { sortMarksByDocumentPosition } from './mark-document-order'
import type { ReadingMark } from '@inkdown/contracts'

function mark(id: string, chapterId: string | null): ReadingMark {
  return {
    id,
    filePath: '/book.epub',
    fileFingerprint: 'fp',
    kind: 'note',
    anchor:
      chapterId === null
        ? { format: 'epub', cfi: 'epubcfi(/6/2)' }
        : { format: 'mobi', chapterId },
    createdAt: 1,
    updatedAt: 1,
  } as ReadingMark
}

const keyOf = (chapterIdByMark: Record<string, string | null>) => (m: ReadingMark) =>
  chapterIdByMark[m.id] ?? null

describe('sortMarksByDocumentPosition', () => {
  it('orders by toc chapter order, keeps in-chapter order, sinks unknown', () => {
    const marks = [mark('c', 'ch2'), mark('a', 'ch1'), mark('b', 'ch1'), mark('z', null)]
    const sorted = sortMarksByDocumentPosition(
      marks,
      ['ch1', 'ch2'],
      keyOf({ c: 'ch2', a: 'ch1', b: 'ch1', z: null }),
    )
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b', 'c', 'z'])
  })

  it('同章内按文档位置（PDF 页码），不再按创建时间', () => {
    const pdf = (id: string, page: number, createdAt: number): ReadingMark => ({
      id,
      filePath: '/book.pdf',
      fileFingerprint: 'fp',
      kind: 'highlight',
      anchor: { format: 'pdf', page },
      createdAt,
      updatedAt: createdAt,
    }) as ReadingMark
    // 输入是创建时间倒序，输出应按页码正序
    const marks = [pdf('p10', 10, 3), pdf('p2', 2, 2), pdf('p1', 1, 1)]
    const sorted = sortMarksByDocumentPosition(marks, ['ch'], () => 'ch')
    expect(sorted.map((m) => m.id)).toEqual(['p1', 'p2', 'p10'])
  })

  it('同章同位按创建时间，同分保输入序', () => {
    const pdf = (id: string, createdAt: number): ReadingMark => ({
      id,
      filePath: '/book.pdf',
      fileFingerprint: 'fp',
      kind: 'highlight',
      anchor: { format: 'pdf', page: 5 },
      createdAt,
      updatedAt: createdAt,
    }) as ReadingMark
    const marks = [pdf('newer', 2), pdf('older', 1)]
    const sorted = sortMarksByDocumentPosition(marks, ['ch'], () => 'ch')
    expect(sorted.map((m) => m.id)).toEqual(['older', 'newer'])
  })

  it('returns copy in original order when no toc order', () => {
    const marks = [mark('b', 'ch2'), mark('a', 'ch1')]
    const sorted = sortMarksByDocumentPosition(marks, [], keyOf({}))
    expect(sorted.map((m) => m.id)).toEqual(['b', 'a'])
    expect(sorted).not.toBe(marks)
  })

  it('tolerates throwing resolvers', () => {
    const marks = [mark('a', 'ch1')]
    const sorted = sortMarksByDocumentPosition(marks, ['ch1'], () => {
      throw new Error('boom')
    })
    expect(sorted.map((m) => m.id)).toEqual(['a'])
  })
})
