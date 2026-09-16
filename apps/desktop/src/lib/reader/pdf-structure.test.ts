import { describe, expect, it } from 'vitest'
import {
  isStructuredPageTextUsable,
  normalizeOneIndexedPages,
  splitMarkdownByPageMarkers,
} from './pdf-structure'

describe('normalizeOneIndexedPages', () => {
  it('过滤非法页并去重排序（防 0/1 起始混用）', () => {
    expect(normalizeOneIndexedPages([0, 3, 2, 2, 99, -1, Number.NaN, 1.9], 3)).toEqual([1, 2, 3])
  })

  it('总页数非法时返回空数组', () => {
    expect(normalizeOneIndexedPages([1], 0)).toEqual([])
  })
})

describe('splitMarkdownByPageMarkers', () => {
  it('按标记切分，首段归属 fallback 页', () => {
    const pages = splitMarkdownByPageMarkers(
      '首页正文\n<!-- Page 2 -->\n第二页正文',
      1,
    )
    expect(pages.get(1)).toBe('首页正文')
    expect(pages.get(2)).toBe('第二页正文')
  })

  it('空段丢弃，畸形标记当正文保留', () => {
    const pages = splitMarkdownByPageMarkers('<!-- Page 1 -->\n\n<!-- Page X -->\n有料', 1)
    expect(pages.get(1)).toBe('<!-- Page X -->\n有料')
    expect(pages.size).toBe(1)
  })

  it('无标记时整档归属 fallback 页', () => {
    const pages = splitMarkdownByPageMarkers('只有正文', 7)
    expect(pages.get(7)).toBe('只有正文')
  })
})

describe('isStructuredPageTextUsable', () => {
  it('空白视为不可用', () => {
    expect(isStructuredPageTextUsable('  \n ')).toBe(false)
    expect(isStructuredPageTextUsable('甲')).toBe(true)
  })
})
