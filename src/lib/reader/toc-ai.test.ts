// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { buildTocAiPrompt, parseTocAiEntries } from './toc-ai'

describe('toc-ai', () => {
  it('prompt 约束 JSON 数组输出并截断超长文本', () => {
    const prompt = buildTocAiPrompt(`${'目录文本。'.repeat(8000)}第一章 绪论 1`)
    expect(prompt).toContain('JSON 数组')
    expect(prompt).toContain('printedPage')
    expect(prompt.length).toBeLessThanOrEqual(31000)
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
})
