import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { migrateBookDb } from './schema'
import { importBookPages } from './import-book'
import { countBookBlocks, getBlockContext, getChapterBlocks, getPageBlocks, locateBlock, searchBookBlocks } from './queries'

function seedDb(): { db: DatabaseSync; bookId: number } {
  const db = new DatabaseSync(':memory:')
  migrateBookDb(db)
  const result = importBookPages(db, {
    fingerprint: 'query-book-1',
    title: '查询书',
    sourcePath: 'D:/book/q.pdf',
    format: 'pdf',
    pageCount: 3,
    pageOffset: 0,
    cleanVersion: 'v3',
    printedToc: [
      { title: '第1章 概述', printedPage: 1, level: 1 },
      { title: '第2章 运算', printedPage: 3, level: 1 },
    ],
    pages: [
      { page: 1, markdown: '# 第1章 概述\n\n流水线技术通过重叠执行指令提升吞吐率' },
      { page: 2, markdown: '取指译码执行三阶段循环是理解基础' },
      { page: 3, markdown: '# 第2章 运算\n\n补码加法 cose' },
    ],
    spansByPage: new Map([
      [1, [{ text: '流水线技术通过重叠执行指令提升吞吐率', confidence: 0.9, x: 5, y: 600, width: 200, height: 12 }]],
    ]),
  })
  return { db, bookId: result.bookId }
}

describe('searchBookBlocks', () => {
  it('中文关键词命中并带章定位', () => {
    const { db, bookId } = seedDb()
    const hits = searchBookBlocks(db, bookId, '流水线')
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ pageNumber: 1, chapterIndex: 0, chapterTitle: '第1章 概述' })
    expect(hits[0]?.snippet).toContain('流水线')
  })

  it('无命中/空关键词返回空数组，不抛错', () => {
    const { db, bookId } = seedDb()
    expect(searchBookBlocks(db, bookId, '人工智能')).toEqual([])
    expect(searchBookBlocks(db, bookId, '   ')).toEqual([])
  })

  it('引号等特殊字符被转义', () => {
    const { db, bookId } = seedDb()
    expect(searchBookBlocks(db, bookId, '"流水线" OR 1=1 --')).toEqual([])
  })
})

describe('getChapterBlocks / getBlockContext / locateBlock', () => {
  it('按章顺序读块，顺序即原文顺序', () => {
    const { db, bookId } = seedDb()
    const blocks = getChapterBlocks(db, bookId, 0)
    expect(blocks.map((b) => b.content)).toEqual([
      '第1章 概述',
      '流水线技术通过重叠执行指令提升吞吐率',
      '取指译码执行三阶段循环是理解基础',
    ])
    expect(countBookBlocks(db, bookId)).toBe(5)
  })

  it('块上下文前后各取', () => {
    const { db, bookId } = seedDb()
    const context = getBlockContext(db, bookId, 0, 1, 1)
    expect(context.map((b) => b.blockIndex)).toEqual([0, 1, 2])
  })

  it('单页块按顺序返回，非法页码空数组', () => {
    const { db, bookId } = seedDb()
    expect(getPageBlocks(db, bookId, 1).map((b) => b.content)).toEqual([
      '第1章 概述',
      '流水线技术通过重叠执行指令提升吞吐率',
    ])
    expect(getPageBlocks(db, bookId, 0)).toEqual([])
  })

  it('块定位返回页与 bbox', () => {    const { db, bookId } = seedDb()
    const target = getChapterBlocks(db, bookId, 0)[1] as { id: number }
    const located = locateBlock(db, target.id)
    expect(located?.pageNumber).toBe(1)
    expect(located?.bbox).toMatchObject({ x: 5, y: 600 })
    // 无 bbox 的块只回页码
    const plain = getChapterBlocks(db, bookId, 1)[1] as { id: number }
    expect(locateBlock(db, plain.id)).toEqual({ pageNumber: 3, bbox: null })
  })
})
