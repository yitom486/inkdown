import { describe, expect, it } from 'vitest'
import {
  buildMobiChapterList,
  buildReadableSpineChapters,
  decodeMobiTocHref,
  encodeMobiTocHref,
  pickReadableMobiChapterCandidates,
  resolveMobiChapterNav,
} from './mobi-navigation'
import type { MobiChapterItem } from './mobi-navigation'
import { findNextDistinctLoadTarget } from './reader-chapter-nav'

describe('mobi toc href', () => {
  it('编码与解码 flat index', () => {
    expect(encodeMobiTocHref(3)).toBe('mobi-toc:3')
    expect(decodeMobiTocHref('mobi-toc:3')).toBe(3)
    expect(decodeMobiTocHref('1')).toBeNull()
  })
})

describe('buildReadableSpineChapters', () => {
  it('跳过空白 spine 切片并提取标题', () => {
    const htmlById: Record<string, string> = {
      '0': '<?xml version="1.0" encoding="UTF-8"?>',
      '1': '<h1>长安与河北之间</h1><p>正文开始。</p>',
      '2': '',
    }

    const chapters = buildReadableSpineChapters(
      [{ id: '0' }, { id: '1' }, { id: '2' }],
      (id) => htmlById[id],
    )

    expect(chapters).toHaveLength(1)
    expect(chapters[0]?.id).toBe('1')
    expect(chapters[0]?.label).toBe('长安与河北之间')
  })
})

describe('buildMobiChapterList', () => {
  it('TOC 条目不可读时降级到可读 spine', () => {
    const htmlById: Record<string, string> = {
      '0': '<?xml version="1.0" encoding="UTF-8"?>',
      '1': '<h1>第一章</h1><p>正文。</p>',
    }
    const loadHtml = (id: string) => htmlById[id]

    const chapters = buildMobiChapterList(
      [{ id: '0' }, { id: '1' }],
      [{ label: '目录', href: 'filepos:100' }],
      loadHtml,
      () => '0',
    )

    expect(chapters).toHaveLength(1)
    expect(chapters[0]?.id).toBe('1')
  })

  it('候选章节包含 spine 兜底顺序', () => {
    const chapters: MobiChapterItem[] = [{ id: '1', label: '第一章', level: 0 }]
    const candidates = pickReadableMobiChapterCandidates(chapters, [
      { id: '0' },
      { id: '1' },
      { id: '2' },
    ])

    expect(candidates.map((item) => item.id)).toEqual(['1', '0', '2'])
  })

  it('优先恢复上次阅读的章节', () => {
    const chapters: MobiChapterItem[] = [
      { id: '0', label: '目录', level: 0 },
      { id: '1', label: '第一章', level: 0 },
      { id: '2', label: '第二章', level: 0 },
    ]
    const candidates = pickReadableMobiChapterCandidates(chapters, [{ id: '0' }, { id: '1' }, { id: '2' }], '2')
    expect(candidates[0]?.id).toBe('2')
  })
})

describe('resolveMobiChapterNav', () => {
  const chapters: MobiChapterItem[] = [
    { id: '0', label: '目录', level: 0 },
    { id: '1', label: '第一章 五星会聚', level: 0 },
    { id: '1', label: '一、小引', level: 1 },
    { id: '2', label: '第二章 长安与魏州', level: 0 },
  ]

  it('指定 flat index 时精确匹配当前目录项', () => {
    const nav = resolveMobiChapterNav(chapters, '1', 2)
    expect(nav.current?.label).toBe('一、小引')
    expect(nav.previous?.label).toBe('第一章 五星会聚')
    expect(nav.next?.label).toBe('第二章 长安与魏州')
  })

  it('仅 spine id 时回退到最后一个匹配项', () => {
    const nav = resolveMobiChapterNav(chapters, '1')
    expect(nav.current?.label).toBe('一、小引')
    expect(nav.next?.label).toBe('第二章 长安与魏州')
  })

  it('上一节跳过目录页', () => {
    const nav = resolveMobiChapterNav(chapters, '2')
    expect(nav.current?.label).toBe('第二章 长安与魏州')
    expect(nav.previous?.label).toBe('一、小引')
  })

  it('单元结构下按最小目录步进', () => {
    const nested: MobiChapterItem[] = [
      { id: '0', label: '目录', level: 0 },
      { id: '1', label: '自序', level: 1 },
      { id: '2', label: '第1章 导论', level: 1 },
      { id: '3', label: '第一单元', level: 1 },
      { id: '3', label: '第2章', level: 2 },
      { id: '3', label: '第3章', level: 2 },
      { id: '3', label: '组织背景', level: 2 },
      { id: '4', label: '第二单元', level: 1 },
      { id: '5', label: '第三单元', level: 1 },
    ]
    const nav = resolveMobiChapterNav(nested, '4', 7)
    expect(nav.current?.label).toBe('第二单元')
    expect(nav.previous?.label).toBe('组织背景')
    expect(nav.next?.label).toBe('第三单元')
  })

  it('滚轮翻页跳过同 spine 条目', () => {
    const nested: MobiChapterItem[] = [
      { id: '3', label: '第2章', level: 2 },
      { id: '3', label: '第3章', level: 2 },
      { id: '4', label: '第二单元', level: 1 },
    ]
    const next = findNextDistinctLoadTarget(nested, 0, {
      getLoadTargetKey: (chapter) => chapter.id,
    })
    expect(next?.item.label).toBe('第二单元')
  })
})
