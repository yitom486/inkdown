import { describe, expect, it } from 'vitest'
import { buildSectionPageMap } from './toc-geometry'
import { extractOcrTocFromText } from './ocr-toc-extractor'

const OPTS = { pageCount: 340, pageOffset: 12 }

function span(text: string, x: number, y: number, confidence = 1) {
  return { text, x, y, confidence }
}

describe('buildSectionPageMap', () => {
  it('同行钉死（第 8 页实录骨架）', () => {
    const result = buildSectionPageMap(
      [
        span('1.2.7 本节习题精选', 109, 410),
        span('8', 474, 410),
        span('1.5 常见问题和易混淆知识点', 84, 308),
        span('18', 467, 308),
        span('1.2.2 计算机硬件', 108, 482),
        span('3', 478, 485, 1),
      ],
      OPTS,
    )
    expect(result.pages.get('1.2.7')).toBe(8)
    expect(result.pages.get('1.5')).toBe(18)
    expect(result.pages.get('1.2.2')).toBe(3)
    expect(result.paired).toBe(3)
  })

  it('低置信串味碎片丢弃（2.1.3 行的 ?25，conf 0.80）', () => {
    const result = buildSectionPageMap(
      [span('2.1.3 整数的表示', 108, 226), span('?25', 467, 227, 0.8)],
      OPTS,
    )
    expect(result.pages.has('2.1.3')).toBe(false)
    expect(result.droppedLowConf).toBe(1)
  })

  it('超范围数字丢弃（水印大数类）', () => {
    const result = buildSectionPageMap(
      [span('3.9 附录', 100, 100), span('999', 470, 100)],
      OPTS,
    )
    expect(result.pages.has('3.9')).toBe(false)
    expect(result.droppedOutOfRange).toBe(1)
  })

  it('一号一用：给 dy 最近的标题', () => {
    const result = buildSectionPageMap(
      [span('1.2.7 甲', 109, 200), span('1.2.8 乙', 109, 210), span('9', 474, 203)],
      OPTS,
    )
    expect(result.pages.get('1.2.7')).toBe(9)
    expect(result.pages.has('1.2.8')).toBe(false)
    expect(result.paired).toBe(1)
  })

  it('章标题无章节号不进映射', () => {
    const result = buildSectionPageMap(
      [span('第1章 计算机系统概述', 62, 572), span('1', 470, 572)],
      OPTS,
    )
    expect(result.paired).toBe(0)
    expect(result.pages.size).toBe(0)
  })
})

describe('几何优先于数字汤', () => {
  it('命中几何的标题不进队列，汤里同数字不再二次配对', () => {
    const entries = extractOcrTocFromText('1.2.7 本节习题精选\n8 9', {
      ...OPTS,
      geometryPages: new Map([['1.2.7', 8]]),
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ title: '1.2.7本节习题精选', printedPage: 8 })
  })
})
