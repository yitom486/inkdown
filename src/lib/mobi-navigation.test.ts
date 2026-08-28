import { describe, expect, it } from 'vitest'
import {
  buildMobiChapterList,
  buildReadableSpineChapters,
  pickReadableMobiChapterCandidates,
  resolveMobiChapterNav,
} from './mobi-navigation'
import type { MobiChapterItem } from './mobi-navigation'

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
})

describe('resolveMobiChapterNav', () => {
  const chapters: MobiChapterItem[] = [
    { id: '0', label: '目录', level: 0 },
    { id: '1', label: '第一章 五星会聚', level: 0 },
    { id: '1', label: '一、小引', level: 1 },
    { id: '2', label: '第二章 长安与魏州', level: 0 },
  ]

  it('底部导航在一级标题间切换', () => {
    const nav = resolveMobiChapterNav(chapters, '1')
    expect(nav.current?.label).toBe('第一章 五星会聚')
    expect(nav.next?.label).toBe('第二章 长安与魏州')
  })
})
