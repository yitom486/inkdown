import { describe, expect, it } from 'vitest'
import { normalizeTocTitle, suggestTocPageOffset } from './toc-offset'

/** 模拟正文页原生文字层：标题落在 PDF 页 = 印刷页 + 12 */
function makeNativeReader(pages: Record<number, string>) {
  return async (pdfPage: number): Promise<string | null> => pages[pdfPage] ?? null
}

describe('toc-offset', () => {
  it('归一化去空白标点', () => {
    expect(normalizeTocTitle('第 一 章：绪论 (上)')).toBe('第一章绪论上')
    expect(normalizeTocTitle('  Hello World! ')).toBe('helloworld')
  })

  it('多标题共识算出偏移', async () => {
    const read = makeNativeReader({
      13: '第一章 绪论 正文开始',
      20: '第二章 背景 正文开始',
      35: '第三章 方法 正文开始',
    })
    const result = await suggestTocPageOffset(
      [
        { title: '第一章 绪论', printedPage: 1 },
        { title: '第二章 背景', printedPage: 8 },
        { title: '第三章 方法', printedPage: 23 },
      ],
      read,
      { pageCount: 100, skipPdfPages: [8, 9, 10, 11, 12] },
    )
    expect(result).toEqual({ offset: 12, agree: 3, total: 3 })
  })

  it('跳过目录页自身的误命中', async () => {
    // 标题字样同时出现在目录页（PDF 8）和正文页（PDF 13）：必须以后者为准
    const read = makeNativeReader({
      8: '目录 第一章 绪论 1 第二章 背景 8',
      13: '第一章 绪论 正文开始',
    })
    const result = await suggestTocPageOffset(
      [{ title: '第一章 绪论', printedPage: 1 }],
      read,
      { pageCount: 100, skipPdfPages: [8, 9, 10, 11, 12] },
    )
    expect(result?.offset).toBe(12)
  })

  it('少数服从多数（个别标题串页不影响）', async () => {
    const read = makeNativeReader({
      13: '第一章 绪论',
      20: '第二章 背景',
      99: '第三章 方法（附录重印处也出现）',
    })
    const result = await suggestTocPageOffset(
      [
        { title: '第一章 绪论', printedPage: 1 },
        { title: '第二章 背景', printedPage: 8 },
        { title: '第三章 方法', printedPage: 23 },
      ],
      read,
      { pageCount: 100 },
    )
    // 前两条共识 12，第三条 76：取众数
    expect(result).toEqual({ offset: 12, agree: 2, total: 3 })
  })

  it('正文无文字层时返回 null（提示手填）', async () => {
    const result = await suggestTocPageOffset(
      [{ title: '第一章 绪论', printedPage: 1 }],
      async () => null,
      { pageCount: 100 },
    )
    expect(result).toBeNull()
  })

  it('过短标题不参与', async () => {
    let calls = 0
    const result = await suggestTocPageOffset(
      [{ title: '序', printedPage: 1 }],
      async () => {
        calls += 1
        return '序言正文'
      },
      { pageCount: 100 },
    )
    expect(result).toBeNull()
    expect(calls).toBe(0)
  })
})
