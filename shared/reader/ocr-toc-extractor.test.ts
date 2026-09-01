import { describe, expect, it } from 'vitest'
import { extractOcrTocFromText, normalizeOcrChinese } from '@shared/reader/ocr-toc-extractor'

describe('ocr-toc-extractor', () => {
  it('normalizeOcrChinese 合并汉字间空格', () => {
    expect(normalizeOcrChinese('计 算 机 发 展')).toBe('计算机发展')
  })

  it('从目录 OCR 文本提取章节', () => {
    const sample = `
日 录
#]1 1 计算 机 发 展 历 程 2
111 计算 机 硬件 的 发 展 1
112 计算 机 软件 的 发 展 2
12.6 计算 机 系统 的 工作 原 理 7
12.8 答案 与 解析 9
第 2 章 数据 的 表示 和 运算 20
2.12 定 点 数 的 编码 表示 2
官方 开源 ， 高 清 带 书签 PDF
`
    const entries = extractOcrTocFromText(sample)
    const titles = entries.map((e) => e.title)
    expect(titles.some((t) => t.includes('计算机发展') || t.startsWith('第1章'))).toBe(true)
    expect(titles.some((t) => t.includes('12.6') && t.includes('工作原理'))).toBe(true)
    expect(entries.every((e) => e.printedPage > 0)).toBe(true)
    expect(entries.some((e) => e.raw.includes('官方'))).toBe(false)
  })
})
