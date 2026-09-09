// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { buildTocAiPrompt, parseTocAiEntries } from './toc-ai'

describe('toc-ai', () => {
  it('prompt 约束 JSON 数组输出并截断超长文本', () => {
    const prompt = buildTocAiPrompt(`${'目录文本。'.repeat(8000)}第一章 绪论 1`, 'fp-1')
    expect(prompt).toContain('JSON 数组')
    expect(prompt).toContain('printedPage')
    expect(prompt).toContain('toc_replace_all')
    expect(prompt).toContain('fp-1')
    expect(prompt).toContain('同行数字')
    expect(prompt.length).toBeLessThanOrEqual(31100)
  })

  it('解析围栏 JSON 并清洗条目', () => {
    const reply = `整理如下：\n\`\`\`json\n${JSON.stringify([
      { title: '第一章 绪论', printedPage: 1, level: 1 },
      { title: '  1.1 背景  ', printedPage: '5', level: '2' },
      { title: '', printedPage: 9, level: 1 },
      { title: '无页码', printedPage: 0, level: 9 },
    ])}\n\`\`\``
    const result = parseTocAiEntries(reply)
    expect(result.entries).toEqual([
      { title: '第一章 绪论', printedPage: 1, level: 1 },
      { title: '1.1 背景', printedPage: 5, level: 2 },
    ])
    expect(result.dropped).toBe(2)
    expect(result.warnings.some((w) => w.includes('丢弃 2 条'))).toBe(true)
  })

  it('页码倒退给出警告但保留条目', () => {
    const result = parseTocAiEntries(
      JSON.stringify([
        { title: '第三章', printedPage: 20, level: 1 },
        { title: '第二章补遗', printedPage: 15, level: 1 },
      ]),
    )
    expect(result.entries).toHaveLength(2)
    expect(result.warnings.some((w) => w.includes('第二章补遗'))).toBe(true)
  })

  it('非 JSON 回复返回空加警告', () => {
    const result = parseTocAiEntries('抱歉，我看不懂这页。')
    expect(result.entries).toEqual([])
    expect(result.warnings).toHaveLength(1)
  })

  it('层级钳制到 1~6', () => {
    const result = parseTocAiEntries(
      JSON.stringify([{ title: '深层', printedPage: 3, level: 99 }]),
    )
    expect(result.entries[0]?.level).toBe(6)
  })

  it('同一页码长连号警告编造嫌疑', () => {
    const items = Array.from({ length: 14 }, (_, i) => ({
      title: `第1.${i + 1}节`,
      printedPage: 78,
      level: 2,
    }))
    const result = parseTocAiEntries(JSON.stringify(items))
    expect(result.entries).toHaveLength(14)
    expect(result.warnings.some((w) => w.includes('疑似编造'))).toBe(true)
  })

  it('短连号不警告', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      title: `第1.${i + 1}节`,
      printedPage: 8,
      level: 2,
    }))
    const result = parseTocAiEntries(JSON.stringify(items))
    expect(result.warnings.some((w) => w.includes('疑似编造'))).toBe(false)
  })

  it('水印碎片按水印口径丢弃并计数', () => {
    const result = parseTocAiEntries(
      JSON.stringify([
        { title: '87929797王道计', printedPage: 149, level: 1 },
        { title: '3.1.2主存储器的组成', printedPage: 31, level: 2 },
      ]),
    )
    expect(result.entries.map((e) => e.title)).toEqual(['3.1.2主存储器的组成'])
    expect(result.dropped).toBe(1)
    expect(result.warnings.some((w) => w.includes('水印'))).toBe(true)
  })
})
