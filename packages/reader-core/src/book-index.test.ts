import { describe, expect, it } from 'vitest'
import {
  applyTocOffset,
  buildBookIndex,
  findChapterForPage,
  findModuleForPage,
  formatModuleLabel,
  modulePageRange,
} from './book-index'

const TOC = [
  { title: '第1章 概述', printedPage: 1, level: 1 },
  { title: '1.1 发展历程', printedPage: 1, level: 2 },
  { title: '1.2 组成', printedPage: 5, level: 2 },
  { title: '第2章 运算', printedPage: 20, level: 1 },
]

describe('applyTocOffset', () => {
  it('印刷页加 offset 得真实页，同页按 level 升序', () => {
    const toc = applyTocOffset(TOC, 18)
    expect(toc.map((e) => [e.title, e.realPage])).toEqual([
      ['第1章 概述', 19],
      ['1.1 发展历程', 19],
      ['1.2 组成', 23],
      ['第2章 运算', 38],
    ])
  })

  it('非法条目丢弃', () => {
    expect(
      applyTocOffset(
        [{ title: '  ', printedPage: 3, level: 1 }, { title: '坏页', printedPage: -2, level: 1 }],
        0,
      ),
    ).toEqual([])
  })

  it('realPage 直给优先（前言等无印刷页码条目）', () => {
    const toc = applyTocOffset(
      [
        { title: '前言', level: 1, realPage: 3 },
        { title: '第1章', level: 1, printedPage: 1 },
        { title: '坏条目', level: 1 },
      ],
      18,
    )
    expect(toc.map((e) => [e.title, e.realPage])).toEqual([
      ['前言', 3],
      ['第1章', 19],
    ])
  })
})

describe('buildBookIndex', () => {
  const index = buildBookIndex({ pageCount: 50, pageOffset: 18, printedToc: TOC, contents: [] })

  it('全页覆盖，无内容页模块照样归属', () => {
    expect(index.pages).toHaveLength(50)
    expect(findModuleForPage(index, 30)?.module).toBe('1.2 组成')
    expect(findModuleForPage(index, 30)?.charCount).toBe(0)
  })

  it('同页章节并存时最具体的胜出', () => {
    expect(findModuleForPage(index, 19)?.module).toBe('1.1 发展历程')
  })

  it('目录首项之前的开篇页未归属', () => {
    expect(findModuleForPage(index, 1)?.module).toBeNull()
    expect(findModuleForPage(index, 18)?.module).toBeNull()
    expect(formatModuleLabel(null)).toBe('开篇（目录前）')
  })

  it('章边界：上一页属旧章，本页属新章', () => {
    expect(findModuleForPage(index, 37)?.module).toBe('1.2 组成')
    expect(findModuleForPage(index, 38)?.module).toBe('第2章 运算')
    expect(findModuleForPage(index, 50)?.module).toBe('第2章 运算')
  })

  it('越界页返回 null', () => {
    expect(findModuleForPage(index, 0)).toBeNull()
    expect(findModuleForPage(index, 51)).toBeNull()
  })

  it('空目录全书未归属', () => {
    const empty = buildBookIndex({ pageCount: 5, pageOffset: 0, printedToc: [], contents: [] })
    expect(empty.pages.every((p) => p.module === null)).toBe(true)
  })

  it('内容信息挂到对应页', () => {
    const withContent = buildBookIndex({
      pageCount: 50,
      pageOffset: 18,
      printedToc: TOC,
      contents: [{ page: 30, headings: ['1.2.1 主存'], hasTables: true, charCount: 900 }],
    })
    expect(findModuleForPage(withContent, 30)).toMatchObject({
      headings: ['1.2.1 主存'],
      hasTables: true,
      charCount: 900,
    })
  })
})

describe('modulePageRange / findChapterForPage', () => {
  const index = buildBookIndex({ pageCount: 50, pageOffset: 18, printedToc: TOC, contents: [] })

  it('模块范围：章到下一章前一页，节到下一同级节前一页', () => {
    expect(modulePageRange(index, 2)).toEqual([23, 37])
    expect(modulePageRange(index, 3)).toEqual([38, 50])
    expect(modulePageRange(index, 9)).toBeNull()
  })

  it('节范围不受同页章条目截断，章范围跨过节直达下一章', () => {
    // toc: [第1章@19/L1, 1.1@19/L2, 1.2@23/L2, 第2章@38/L1]
    expect(modulePageRange(index, 0)).toEqual([19, 37])
    expect(modulePageRange(index, 1)).toEqual([19, 22])
  })

  it('章归属：节内页回落到所属章', () => {
    expect(findChapterForPage(index, 30)?.title).toBe('第1章 概述')
    expect(findChapterForPage(index, 40)?.title).toBe('第2章 运算')
    expect(findChapterForPage(index, 5)).toBeNull()
  })
})
