import { describe, expect, it } from 'vitest'
import {
  pickReaderNavLevel,
  resolveReaderChapterNav,
  resolveTopLevelChapterNav,
} from './reader-chapter-nav'

describe('pickReaderNavLevel', () => {
  it('EPUB 目录下挂正文章节时使用二级目录导航', () => {
    const chapters = [
      { label: '目录', level: 0 },
      { label: '自序', level: 1 },
      { label: '第1章 导论', level: 1 },
      { label: '第2章 组织研究', level: 1 },
    ]
    expect(pickReaderNavLevel(chapters, (chapter) => chapter.label === '目录')).toBe(1)
  })

  it('MOBI 一级章节为主时使用 level 0', () => {
    const chapters = [
      { label: '目录', level: 0 },
      { label: '第一章', level: 0 },
      { label: '一、小引', level: 1 },
      { label: '第二章', level: 0 },
    ]
    expect(pickReaderNavLevel(chapters, (chapter) => chapter.label === '目录')).toBe(0)
  })
})

describe('resolveReaderChapterNav', () => {
  const chapters = [
    { label: '第一章', level: 0 },
    { label: '一、小引', level: 1 },
    { label: '第二章', level: 0 },
  ]

  it('从二级目录位置回溯到所属一级章节', () => {
    const nav = resolveReaderChapterNav(chapters, 1, 0)
    expect(nav.current?.label).toBe('第一章')
    expect(nav.next?.label).toBe('第二章')
    expect(nav.previous).toBeNull()
  })

  it('在二级目录层级间切换', () => {
    const nested = [
      { label: '目录', level: 0 },
      { label: '自序', level: 1 },
      { label: '第1章', level: 1 },
      { label: '第2章', level: 1 },
    ]
    const nav = resolveReaderChapterNav(nested, 1, 1, (chapter) => chapter.label === '目录')
    expect(nav.current?.label).toBe('自序')
    expect(nav.next?.label).toBe('第1章')
    expect(nav.previous).toBeNull()
  })

  it('上一章/下一章跳过目录类条目', () => {
    const nested = [
      { label: '目录', level: 0 },
      { label: '自序', level: 1 },
      { label: '第1章', level: 1 },
    ]
    const isToc = (chapter: { label: string }) => chapter.label === '目录'
    const fromCh1 = resolveReaderChapterNav(nested, 2, 1, isToc)
    expect(fromCh1.previous?.label).toBe('自序')
    expect(fromCh1.next).toBeNull()
  })
})


describe('resolveTopLevelChapterNav', () => {
  const chapters = [
    { label: '第一章', level: 0 },
    { label: '一、小引', level: 1 },
    { label: '第二章', level: 0 },
  ]

  it('从二级目录位置回溯到所属一级章节', () => {
    const nav = resolveTopLevelChapterNav(chapters, 1)
    expect(nav.current?.label).toBe('第一章')
    expect(nav.next?.label).toBe('第二章')
    expect(nav.previous).toBeNull()
  })
})
