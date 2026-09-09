import { describe, expect, it } from 'vitest'
import {
  normalizeInspectorSpans,
  ocrPageCacheToTextContent,
  pageHasNativeText,
  splitCjkUnits,
} from './ocr-page-words'
import type { PdfOcrPageCache } from '@shared/types/ocr'

describe('ocr-page-words', () => {
  it('pageHasNativeText 阈值', () => {
    expect(pageHasNativeText(0)).toBe(false)
    expect(pageHasNativeText(20)).toBe(true)
  })

  it('ocrPageCacheToTextContent 生成 TextItem', () => {    const cache: PdfOcrPageCache = {
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

describe('splitCjkUnits', () => {
  it('中文逐字、拉丁按词', () => {
    expect(splitCjkUnits('Hello世界和平')).toEqual(['Hello', '世', '界', '和', '平'])
    expect(splitCjkUnits('  ')).toEqual([])
  })
})

describe('normalizeInspectorSpans', () => {
  it('中文行按字等分（y-up 转左上原点）', () => {
    const words = normalizeInspectorSpans(
      [{ text: '甲乙', confidence: 0.9, x: 10, y: 700, width: 20, height: 10 }],
      100,
      800,
    )
    expect(words).toHaveLength(2)
    expect(words[0]?.text).toBe('甲')
    expect(words[0]?.bbox.x0).toBeCloseTo(0.1, 6)
    expect(words[0]?.bbox.x1).toBeCloseTo(0.2, 6)
    expect(words[0]?.bbox.y0).toBeCloseTo(0.1125, 6)
    expect(words[0]?.bbox.y1).toBeCloseTo(0.125, 6)
    expect(words[1]?.text).toBe('乙')
    expect(words[1]?.bbox.x0).toBeCloseTo(0.2, 6)
    expect(words[1]?.bbox.x1).toBeCloseTo(0.3, 6)
  })

  it('拉丁行整词保留、低置信丢弃', () => {
    const words = normalizeInspectorSpans(
      [
        { text: 'Hello World', confidence: 0.99, x: 0, y: 0, width: 100, height: 10 },
        { text: 'junk', confidence: 0.1, x: 0, y: 0, width: 100, height: 10 },
      ],
      100,
      100,
    )
    expect(words.map((w) => w.text)).toEqual(['Hello', 'World'])
  })

  it('非法输入返回空', () => {
    expect(normalizeInspectorSpans([], 100, 100)).toEqual([])
    expect(
      normalizeInspectorSpans(
        [{ text: '甲', confidence: 0.9, x: 0, y: 0, width: 10, height: 10 }],
        0,
        100,
      ),
    ).toEqual([])
  })
})
