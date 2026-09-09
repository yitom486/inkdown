import { describe, expect, it } from 'vitest'
import { buildPdfOcrTocCache } from './pdf-ocr-toc-cache'

describe('buildPdfOcrTocCache', () => {
  it('用户保存标 reviewed 并保留条目 source（合并裁决用）', () => {
    const cache = buildPdfOcrTocCache({
      fileFingerprint: 'fp-1',
      tocPageRange: [8, 12],
      pageOffset: 12,
      entries: [
        { title: '3.5.4替换算法', printedPage: 114, level: 2, source: 'geo' },
        { title: '1.1.1硬件', printedPage: 2, level: 2, source: 'manual' },
        { title: '3.1父项', printedPage: 77, level: 1 },
      ],
    })
    expect(cache.origin).toBe('reviewed')
    expect(cache.entries.map((entry) => entry.source)).toEqual(['geo', 'manual', undefined])
    expect(cache.units).toHaveLength(3)
    expect(cache.units[0]).toEqual({ label: '3.5.4替换算法', href: '126', level: 2 })
  })

  it('空标题与非法页码照旧过滤', () => {
    const cache = buildPdfOcrTocCache({
      fileFingerprint: 'fp-1',
      tocPageRange: [8, 12],
      pageOffset: 12,
      entries: [
        { title: '   ', printedPage: 5, level: 1 },
        { title: '有效', printedPage: 0, level: 1 },
        { title: '保留', printedPage: 3, level: 1, source: 'ai' },
      ],
    })
    expect(cache.entries.map((entry) => entry.title)).toEqual(['保留'])
  })
})
