import { describe, expect, it } from 'vitest'
import {
  assembleBookMarkdown,
  mapClassification,
  mapPagesMarkdown,
  toOneIndexed,
  toZeroIndexed,
} from './normalize'

describe('toOneIndexed', () => {
  it('过滤非有限与负数后 floor+1', () => {
    expect(toOneIndexed([0, 1.9, -1, Number.NaN, Number.POSITIVE_INFINITY, 2])).toEqual([
      1, 2, 3,
    ])
  })

  it('空数组返回空数组', () => {
    expect(toOneIndexed([])).toEqual([])
  })
})

describe('toZeroIndexed', () => {
  it('undefined 返回 undefined', () => {
    expect(toZeroIndexed(undefined)).toBeUndefined()
  })

  it('过滤 <1、NaN、无穷后 floor-1', () => {
    expect(
      toZeroIndexed([1, 1.9, 2, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]),
    ).toEqual([0, 0, 1])
  })
})

describe('mapClassification', () => {
  it('归一 pagesNeedingOcr 并保留其余字段', () => {
    const result = mapClassification({
      pdfType: 'Mixed',
      pageCount: 3,
      pagesNeedingOcr: [0, 2.7, -1, Number.NaN],
      confidence: 0.8,
    })
    expect(result).toEqual({
      pdfType: 'Mixed',
      pageCount: 3,
      pagesNeedingOcr: [1, 3],
      confidence: 0.8,
    })
  })
})

describe('mapPagesMarkdown', () => {
  it('逐页 floor+1 且缺 markdown 默认为空串', () => {
    const result = mapPagesMarkdown({
      pages: [
        { page: 0, markdown: 'a' },
        { page: 1.9 },
        { page: 2, markdown: null },
      ],
      pagesWithTables: [1],
      pagesWithColumns: [2],
      pagesNeedingOcr: [1],
      isComplex: true,
    })
    expect(result.pages).toEqual([
      { page: 1, markdown: 'a' },
      { page: 2, markdown: '' },
      { page: 3, markdown: '' },
    ])
    expect(result.pagesWithTables).toEqual([1])
    expect(result.pagesWithColumns).toEqual([2])
    expect(result.pagesNeedingOcr).toEqual([1])
    expect(result.isComplex).toBe(true)
  })
})

describe('assembleBookMarkdown', () => {
  it('按 page 排序且首块无标记、后续带标记', () => {
    const result = assembleBookMarkdown({
      pages: [
        { page: 2, markdown: 'c2' },
        { page: 0, markdown: 'c0' },
        { page: 1, markdown: 'c1' },
      ],
      pagesWithTables: [2],
      pagesWithColumns: [],
      pagesNeedingOcr: [],
      isComplex: false,
    })
    expect(result.markdown).toBe('c0\n<!-- Page 2 -->\nc1\n<!-- Page 3 -->\nc2')
    expect(result.pageCount).toBe(3)
    expect(result.pagesWithTables).toEqual([2])
  })

  it('单页无标记、空档为空串', () => {
    expect(
      assembleBookMarkdown({
        pages: [{ page: 0, markdown: 'only' }],
        pagesWithTables: [],
        pagesWithColumns: [],
        pagesNeedingOcr: [],
        isComplex: false,
      }).markdown,
    ).toBe('only')
    const empty = assembleBookMarkdown({
      pages: [],
      pagesWithTables: [],
      pagesWithColumns: [],
      pagesNeedingOcr: [],
      isComplex: false,
    })
    expect(empty.markdown).toBe('')
    expect(empty.pageCount).toBe(0)
  })

  it('缺 markdown 按空串拼接标记格式不变', () => {
    const result = assembleBookMarkdown({
      pages: [{ page: 0, markdown: 'a' }, { page: 1 }],
      pagesWithTables: [],
      pagesWithColumns: [],
      pagesNeedingOcr: [],
      isComplex: false,
    })
    expect(result.markdown).toBe('a\n<!-- Page 2 -->\n')
  })
})
