import { describe, expect, it } from 'vitest'
import type { ReadingMark } from '@shared/types/reading-mark'
import {
  bookTitleFromPath,
  buildReadingNotesExport,
  buildReadingNotesFileName,
  filterMarksForNotesExport,
  resolveEpubChapter,
  resolveMobiChapter,
  tocFromEpubUnits,
  tocFromMobiUnits,
} from './export-reading-notes'

function mark(overrides: Partial<ReadingMark> & Pick<ReadingMark, 'id' | 'kind' | 'anchor'>): ReadingMark {
  return {
    filePath: '/books/demo.epub',
    fileFingerprint: 'fp',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('export-reading-notes', () => {
  const toc = tocFromEpubUnits([
    { href: 'chap1.xhtml', label: '第一章' },
    { href: 'chap2.xhtml#frag', label: '第二章' },
  ])

  it('按内容类型过滤：批注 / 重点 / 综合', () => {
    const marks = [
      mark({
        id: 'n',
        kind: 'note',
        note: '我的批注',
        excerpt: '原文甲',
        anchor: { format: 'epub', cfi: 'a', href: 'chap1.xhtml' },
      }),
      mark({
        id: 'h',
        kind: 'highlight',
        excerpt: '原文乙',
        anchor: { format: 'epub', cfi: 'b', href: 'chap1.xhtml' },
      }),
      mark({
        id: 'b',
        kind: 'bookmark',
        anchor: { format: 'epub', cfi: 'c', href: 'chap1.xhtml' },
      }),
    ]

    expect(filterMarksForNotesExport(marks, 'notes').map((item) => item.id)).toEqual(['n'])
    expect(filterMarksForNotesExport(marks, 'highlights').map((item) => item.id)).toEqual(['h'])
    expect(filterMarksForNotesExport(marks, 'combined').map((item) => item.id)).toEqual(['n', 'h'])
  })

  it('EPUB resolveChapter 用 normalizeLoadKey 对齐目录', () => {
    const hit = resolveEpubChapter(
      mark({
        id: '1',
        kind: 'highlight',
        excerpt: 'x',
        anchor: { format: 'epub', cfi: 'c', href: 'Chap2.XHTML#x' },
      }),
      toc,
    )
    expect(hit).toMatchObject({ matchKey: 'chap2.xhtml', label: '第二章', level: 0 })
  })

  it('MOBI resolveChapter 用 chapterId', () => {
    const mobiToc = tocFromMobiUnits([
      { id: 'c1', label: '开篇' },
      { id: 'c2', label: '中篇' },
    ])
    expect(
      resolveMobiChapter(
        mark({
          id: '1',
          kind: 'highlight',
          excerpt: 'x',
          anchor: { format: 'mobi', chapterId: 'c2' },
        }),
        mobiToc,
      ),
    ).toMatchObject({ matchKey: 'c2', label: '中篇', level: 0 })
  })

  it('全书综合：按章输出，空章跳过，块间 ---', () => {
    const marks = [
      mark({
        id: '1',
        kind: 'note',
        note: '同意',
        excerpt: '第一句',
        createdAt: 1,
        anchor: { format: 'epub', cfi: 'a', href: 'chap1.xhtml' },
      }),
      mark({
        id: '2',
        kind: 'highlight',
        excerpt: '第二句',
        createdAt: 2,
        anchor: { format: 'epub', cfi: 'b', href: 'chap1.xhtml' },
      }),
      mark({
        id: '3',
        kind: 'highlight',
        excerpt: '第三章句',
        createdAt: 3,
        anchor: { format: 'epub', cfi: 'c', href: 'chap2.xhtml' },
      }),
    ]

    const result = buildReadingNotesExport({
      marks,
      toc,
      contentKind: 'combined',
      scope: 'book',
      bookTitle: '示例书',
      resolveChapter: resolveEpubChapter,
      now: new Date(2026, 7, 30, 18, 5),
    })

    expect(result).not.toBeNull()
    expect(result!.suggestedName).toBe('示例书-20260830-1805.md')
    expect(result!.markdown).toContain('# 示例书')
    expect(result!.markdown).toContain('## 第一章')
    expect(result!.markdown).toContain('同意')
    expect(result!.markdown).toContain('**重点**')
    expect(result!.markdown).toContain('> 第一句')
    expect(result!.markdown).toContain('---')
    expect(result!.markdown).toContain('## 第二章')
  })

  it('全书按目录层级：章 ##、节 ###，空叶不写、祖先标题保留', () => {
    const nestedToc = tocFromEpubUnits([
      { href: 'p1.xhtml', label: '第一部分', level: 0 },
      { href: 'c1.xhtml', label: '第一章', level: 1 },
      { href: 'c1.xhtml#s1', label: '一、小引', level: 2 },
      { href: 'c2.xhtml', label: '第二章', level: 1 },
    ])

    const result = buildReadingNotesExport({
      marks: [
        mark({
          id: 'n',
          kind: 'note',
          note: '小节笔记',
          excerpt: '原文',
          anchor: { format: 'epub', cfi: 'a', href: 'c1.xhtml' },
        }),
      ],
      toc: nestedToc,
      contentKind: 'notes',
      scope: 'book',
      bookTitle: '示例书',
      resolveChapter: resolveEpubChapter,
      now: new Date(2026, 7, 30, 18, 5),
    })

    expect(result!.markdown).toContain('## 第一部分')
    expect(result!.markdown).toContain('### 第一章')
    expect(result!.markdown).toContain('#### 一、小引')
    expect(result!.markdown).toContain('小节笔记')
    expect(result!.markdown).not.toContain('## 第二章')
    expect(result!.markdown).not.toContain('### 第二章')
  })

  it('本章批注：仅当前章且仅有 note', () => {
    const marks = [
      mark({
        id: '1',
        kind: 'note',
        note: '章一批注',
        excerpt: 'A',
        anchor: { format: 'epub', cfi: 'a', href: 'chap1.xhtml' },
      }),
      mark({
        id: '2',
        kind: 'note',
        note: '章二批注',
        excerpt: 'B',
        anchor: { format: 'epub', cfi: 'b', href: 'chap2.xhtml' },
      }),
    ]

    const result = buildReadingNotesExport({
      marks,
      toc,
      contentKind: 'notes',
      scope: 'chapter',
        currentChapter: { key: 'chap1.xhtml', matchKey: 'chap1.xhtml', label: '第一章', level: 0 },
      bookTitle: '示例书',
      resolveChapter: resolveEpubChapter,
      now: new Date(2026, 7, 30, 9, 0),
    })

    expect(result!.suggestedName).toBe('示例书：第一章-20260830-0900.md')
    expect(result!.markdown).toContain('章一批注')
    expect(result!.markdown).not.toContain('章二批注')
    expect(result!.chapterCount).toBe(1)
  })

  it('无内容返回 null', () => {
    expect(
      buildReadingNotesExport({
        marks: [],
        toc,
        contentKind: 'combined',
        scope: 'book',
        bookTitle: '空',
        resolveChapter: resolveEpubChapter,
      }),
    ).toBeNull()
  })

  it('综合：重叠≥80% 的重点与批注合并为最长摘录 + 批注', () => {
    const marks = [
      mark({
        id: 'h',
        kind: 'highlight',
        excerpt: '在中国人的观念里，三十年为一世，而道更也。中华人民共和国建国迄今六十余年',
        createdAt: 1,
        anchor: { format: 'epub', cfi: 'a', href: 'chap1.xhtml' },
      }),
      mark({
        id: 'n',
        kind: 'note',
        note: '两世更迭',
        excerpt: '在中国人的观念里，三十年为一世，而道更也。中华人民共和国建国迄今六十余年，已历两世',
        createdAt: 2,
        anchor: { format: 'epub', cfi: 'b', href: 'chap1.xhtml' },
      }),
    ]

    const filtered = filterMarksForNotesExport(marks, 'combined')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.note).toBe('两世更迭')
    expect(filtered[0]?.excerpt).toContain('已历两世')
    expect(filtered[0]?.kind).toBe('highlight')

    const result = buildReadingNotesExport({
      marks,
      toc,
      contentKind: 'combined',
      scope: 'book',
      bookTitle: '示例书',
      resolveChapter: resolveEpubChapter,
      now: new Date(2026, 7, 30, 18, 5),
    })
    expect(result!.markdown).toContain('两世更迭')
    expect(result!.markdown).toContain('> 在中国人的观念里')
    expect(result!.markdown).not.toContain('**重点**')
    expect(result!.markCount).toBe(1)
  })

  it('综合：重叠不足 80% 不合并', () => {
    const marks = [
      mark({
        id: 'h',
        kind: 'highlight',
        excerpt: 'ABCDEFGHIJ',
        anchor: { format: 'epub', cfi: 'a', href: 'chap1.xhtml' },
      }),
      mark({
        id: 'n',
        kind: 'note',
        note: '短',
        excerpt: 'ABC',
        anchor: { format: 'epub', cfi: 'b', href: 'chap1.xhtml' },
      }),
    ]
    expect(filterMarksForNotesExport(marks, 'combined')).toHaveLength(2)
  })

  it('文件名去掉非法字符', () => {
    expect(
      buildReadingNotesFileName({
        bookTitle: 'a/b:c*',
        scope: 'book',
        now: new Date(2026, 0, 1, 0, 0),
      }),
    ).toBe('abc-20260101-0000.md')
  })

  it('本章文件名：短书名：短章名-时间戳', () => {
    expect(
      buildReadingNotesFileName({
        bookTitle: '红色工程师的崛起',
        chapterLabel: '群峰并峙 峥嵘相映 《三十·三十书系》编者按',
        scope: 'chapter',
        now: new Date(2026, 7, 30, 18, 59),
      }),
    ).toBe('红色工程师的崛起：群峰并峙 峥嵘相映 《三十·三十书系》编者按-20260830-1859.md')
  })

  it('bookTitleFromPath 清洗下载站长名并取主标题', () => {
    expect(bookTitleFromPath('D:\\books\\三体.epub')).toBe('三体')
    expect(bookTitleFromPath('/tmp/x.azw3')).toBe('x')
    expect(
      bookTitleFromPath(
        'D:\\book\\红色工程师的崛起：清华大学与中国技术官僚阶级的起源(安舟) (z-library.sk, 1lib.sk, z-lib.sk).epub',
      ),
    ).toBe('红色工程师的崛起')
  })
})
