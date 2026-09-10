import { describe, expect, it } from 'vitest'
import {
  cleanOcrWatermarks,
  discoverWatermarksByPosition,
  expandWatermarkFragments,
  isDiagonalStampSpan,
  normalizeWatermarkText,
} from './ocr-watermark'
import type { InspectorSpanLike } from './ocr-page-words'

function span(text: string, x: number, y: number, page = 1): InspectorSpanLike & { page: number } {
  return { text, confidence: 0.9, x, y, width: 60, height: 12, page }
}

function pagesWithSpans(count: number, mk: (page: number) => InspectorSpanLike[]) {
  return Array.from({ length: count }, (_, i) => ({
    page: i + 1,
    markdown: '',
    spans: mk(i + 1),
  }))
}

describe('normalizeWatermarkText', () => {
  it('空格/标点/大小写变体归一到同一键', () => {
    expect(normalizeWatermarkText('#### 王道 育')).toBe('王道育')
    expect(normalizeWatermarkText('王道育')).toBe('王道育')
    expect(normalizeWatermarkText('Bilibili．COM 搜索')).toBe('bilibilicom搜索')
  })

  it('NFKC 折叠全角拉丁', () => {
    expect(normalizeWatermarkText('ｂｉｌｉｂｉｌｉ．ｃｏｍ搜索王道')).toBe('bilibilicom搜索王道')
  })
})

describe('discoverWatermarksByPosition', () => {
  it('同文本同位置跨页出现 ⇒ 水印', () => {
    const found = discoverWatermarksByPosition(
      pagesWithSpans(10, () => [span('王道计', 100, 700)]),
    )
    expect(found).toContain('王道计')
  })

  it('同文本但位置随阅读流变化（小节标题）⇒ 不定罪', () => {
    const found = discoverWatermarksByPosition(
      pagesWithSpans(10, (page) => [span('二、综合应用题', 100, 100 + page * 37)]),
    )
    expect(found).not.toContain('二综合应用题')
  })

  it('不足 3 页不自动发现', () => {
    expect(discoverWatermarksByPosition(pagesWithSpans(2, () => [span('王道计', 1, 1)]))).toEqual(
      [],
    )
  })

  it('低置信度 span 不作证', () => {
    const pages = pagesWithSpans(10, () => [
      { text: '王道计', confidence: 0.1, x: 5, y: 5, width: 10, height: 5 },
    ])
    expect(discoverWatermarksByPosition(pages)).toEqual([])
  })
})

describe('expandWatermarkFragments', () => {
  const pages = Array.from({ length: 10 }, (_, i) => ({
    page: i + 1,
    markdown: i % 2 === 0 ? '王道计算\n王道在线\n正文' : '王道计算\n正文',
  }))

  it('已证水印的子串碎片跨页出现 ⇒ 补进集合', () => {
    expect(expandWatermarkFragments(pages, new Set(['王道计算机教育']))).toEqual(['王道计算'])
  })

  it('非子串短行不进集合', () => {
    expect(expandWatermarkFragments(pages, new Set(['王道计算机教育']))).not.toContain('王道在线')
  })

  it('无母体/不足3页不扩展', () => {
    expect(expandWatermarkFragments(pages, new Set())).toEqual([])
    expect(expandWatermarkFragments(pages.slice(0, 2), new Set(['王道计算机教育']))).toEqual([])
  })
})

describe('cleanOcrWatermarks', () => {
  const wmPages = pagesWithSpans(10, () => [span('王道计', 300, 400)]);

  it('整行水印删除、行首水印 token 修剪（未知残片保留）', () => {
    const result = cleanOcrWatermarks(
      wmPages.map((p, i) => ({
        ...p,
        markdown: i === 0 ? '#### 王道计 育\n正文第一行\n王道计' : '正文',
      })),
      { known: ['王道育'] },
    )
    // “王道计”已证水印被修剪，“育”无证据保留；纯水印行整行删除
    expect(result.pages[0]?.markdown).toBe('#### 育\n正文第一行')
    expect(result.removedLines).toBe(1)
    expect(result.trimmedLines).toBe(1)
    expect(result.watermarkCount).toBeGreaterThan(0)
  })

  it('行尾水印 token 修剪，保留真实标题', () => {
    const result = cleanOcrWatermarks(
      wmPages.map((p) => ({ ...p, markdown: '##### 王道计算机考研题库 王道计' })),
    )
    expect(result.pages[0]?.markdown).toBe('##### 王道计算机考研题库')
    expect(result.trimmedLines).toBe(10)
  })

  it('水印 glued 行多轮剥离至整行删除', () => {
    const pages = pagesWithSpans(10, () => [
      span('官方开源高清带书签pdf', 10, 10),
      span('最新配套视频请上bilibilicom搜索王道', 10, 60),
    ])
    const md = '#### 官方开源，高清带书签PDF 最新配套视频请上bilibili.com 搜索“王道”'
    const result = cleanOcrWatermarks(pages.map((p) => ({ ...p, markdown: md })))
    expect(result.pages[0]?.markdown).toBe('')
    expect(result.removedLines).toBe(10)
  })

  it('表格行与页标记永不删除（即使进 known）', () => {
    const md = '| 考点 | 说明 |\n|---|---|\n<!-- Page 7 -->\n|---|---|'
    const result = cleanOcrWatermarks([{ page: 1, markdown: md }], {
      known: ['|---|---|', '考点说明'],
    })
    expect(result.pages[0]?.markdown).toBe(md)
    expect(result.removedLines).toBe(0)
  })

  it('含水印词的长正文段落不受伤', () => {
    const para =
      '“王道考研系列”是计算机考研学子口碑相传的辅导书，自2011版首次推出以来销量榜首。'
    const result = cleanOcrWatermarks([{ page: 1, markdown: para }], { known: ['王道计'] })
    expect(result.pages[0]?.markdown).toBe(para)
  })

  it('markdown-only 无 known 时不自动删除', () => {
    const md = '二、综合应用题\n王道计'
    const result = cleanOcrWatermarks([{ page: 1, markdown: md }])
    expect(result.pages[0]?.markdown).toBe(md)
    expect(result.removedLines).toBe(0)
  })
})

describe('isDiagonalStampSpan', () => {
  const known = new Set(['stamptext'])
  it('已证水印 + 方形框 ⇒ 斜戳印', () => {
    expect(
      isDiagonalStampSpan(
        { text: 'StampText', confidence: 0.95, x: 200, y: 300, width: 100, height: 100 },
        known,
      ),
    ).toBe(true)
  })
  it('已证水印 + 横排薄长框 ⇒ 正文豁免（如每页重复页脚）', () => {
    expect(
      isDiagonalStampSpan(
        { text: 'StampText', confidence: 0.95, x: 1, y: 0, width: 407.5, height: 25 },
        known,
      ),
    ).toBe(false)
  })
  it('方形框 + 未知文本 ⇒ 不定罪', () => {
    expect(
      isDiagonalStampSpan(
        { text: '正文标题', confidence: 0.95, x: 200, y: 300, width: 100, height: 100 },
        known,
      ),
    ).toBe(false)
  })
})
