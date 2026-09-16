import { describe, expect, it } from 'vitest'
import type { ReaderUnitText } from './reader-content-registry'
import { inspectEbookSections } from './inspect-ebook-sections'

async function* unitsOf(units: ReaderUnitText[]): AsyncIterable<ReaderUnitText> {
  yield* units
}

describe('inspectEbookSections', () => {
  it('两章多行命中：total 精确、来源与定位正确、无页码无路径', async () => {
    const result = await inspectEbookSections(
      unitsOf([
        { label: '第一章 概述', text: '王道计是出版社\n普通行\n出版社是王道计' },
        { label: '第二章 运算', text: '无关正文' },
      ]),
      '王道计',
      10,
    )
    expect(result).toMatchObject({ query: '王道计', total: 2, truncated: false, limit: 10 })
    expect(result.hits).toHaveLength(2)
    expect(result.hits[0]).toMatchObject({
      source: 'ebook-section',
      locator: { chapterTitle: '第一章 概述', lineStart: 1 },
      matchPosition: 'start',
    })
    expect(result.hits[1]).toMatchObject({
      locator: { chapterTitle: '第一章 概述', lineStart: 3 },
      matchPosition: 'end',
    })
    for (const hit of result.hits) {
      expect(hit.locator).not.toHaveProperty('pageNumber')
      expect(hit.locator).not.toHaveProperty('blockId')
      expect(hit.locator).not.toHaveProperty('filePath')
    }
  })

  it('limit 截断展示但 total 含未展示行', async () => {
    const result = await inspectEbookSections(
      unitsOf([
        { label: '第一章', text: '王道计甲\n王道计乙' },
        { label: '第二章', text: '王道计丙' },
      ]),
      '王道计',
      2,
    )
    expect(result.total).toBe(3)
    expect(result.truncated).toBe(true)
    expect(result.hits).toHaveLength(2)
  })

  it('零命中与空单元返回 total=0 合法 JSON', async () => {
    expect(await inspectEbookSections(unitsOf([]), '王道计', 10)).toMatchObject({
      total: 0,
      hits: [],
      truncated: false,
    })
    const empty = await inspectEbookSections(
      unitsOf([{ label: '空章', text: '' }, { label: '次章', text: '纯正文' }]),
      '王道计',
      10,
    )
    expect(empty).toMatchObject({ total: 0, hits: [] })
  })

  it('坏单元迭代器中断仍返回已收集命中，不抛错', async () => {
    async function* flaky(): AsyncIterable<ReaderUnitText> {
      yield { label: '第一章', text: '王道计甲' }
      throw new Error('section load failed')
    }
    const result = await inspectEbookSections(flaky(), '王道计', 10)
    expect(result.total).toBe(1)
    expect(result.hits).toHaveLength(1)
  })
})
