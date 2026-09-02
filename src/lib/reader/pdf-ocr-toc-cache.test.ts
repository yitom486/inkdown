import { describe, expect, it } from 'vitest'
import { buildPdfOcrTocCache, readerUnitsToOcrEntries } from '@/lib/reader/pdf-ocr-toc-cache'

describe('pdf-ocr-toc-cache', () => {
  it('buildPdfOcrTocCache 按偏移生成 units', () => {
    const cache = buildPdfOcrTocCache({
      fileFingerprint: 'fp',
      tocPageRange: [8, 12],
      pageOffset: 12,
      entries: [{ title: '第1章 概述', printedPage: 1, level: 0 }],
    })

    expect(cache.units).toEqual([{ label: '第1章 概述', href: '13', level: 0 }])
  })

  it('readerUnitsToOcrEntries 可从 units 反推印刷页', () => {
    const entries = readerUnitsToOcrEntries(
      [{ label: '2.1 运算器', href: '25', level: 1 }],
      12,
    )

    expect(entries).toEqual([{ title: '2.1 运算器', printedPage: 13, level: 1 }])
  })
})
