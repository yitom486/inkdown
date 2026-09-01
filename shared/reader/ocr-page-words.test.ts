import { describe, expect, it } from 'vitest'
import { normalizeOcrWords, ocrPageCacheToTextContent, pageHasNativeText } from './ocr-page-words'
import type { PdfOcrPageCache } from '@shared/types/ocr'

describe('ocr-page-words', () => {
  it('pageHasNativeText 阈值', () => {
    expect(pageHasNativeText(0)).toBe(false)
    expect(pageHasNativeText(20)).toBe(true)
  })

  it('normalizeOcrWords 归一化 bbox', () => {
    const words = normalizeOcrWords(
      [
        {
          text: '计 算 机',
          confidence: 90,
          bbox: { x0: 10, y0: 20, x1: 110, y1: 40 },
        },
      ],
      200,
      400,
    )
    expect(words).toEqual([
      {
        text: '计算机',
        bbox: { x0: 0.05, y0: 0.05, x1: 0.55, y1: 0.1 },
      },
    ])
  })

  it('ocrPageCacheToTextContent 生成 TextItem', () => {
    const cache: PdfOcrPageCache = {
      fileFingerprint: 'a|1',
      page: 1,
      pageWidth: 100,
      pageHeight: 200,
      ocrScale: 2,
      createdAt: '2026-01-01',
      words: [{ text: '测试', bbox: { x0: 0.1, y0: 0.2, x1: 0.3, y1: 0.25 } }],
    }
    const content = ocrPageCacheToTextContent(cache)
    expect(content.items).toHaveLength(1)
    expect(content.items[0]).toMatchObject({ str: '测试', width: 20 })
  })
})
