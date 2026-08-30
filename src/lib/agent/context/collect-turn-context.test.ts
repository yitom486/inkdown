import { describe, expect, it } from 'vitest'
import { collectTocTopLevel, TOC_TOP_LEVEL_LIMIT } from './collect-turn-context'

describe('collectTocTopLevel', () => {
  it('取最小 level 的条目并去重、截断条数', () => {
    const labels = collectTocTopLevel([
      { label: '导言', level: 0 },
      { label: '第一节', level: 1 },
      { label: '第一章', level: 0 },
      { label: '第二章', level: 0 },
      { label: '第一章', level: 0 },
    ])
    expect(labels).toEqual(['导言', '第一章', '第二章'])
  })

  it('扁平目录取前 N 条', () => {
    const units = Array.from({ length: 15 }, (_, i) => ({
      label: `第${i + 1}章`,
      level: 1,
    }))
    const labels = collectTocTopLevel(units)
    expect(labels).toHaveLength(TOC_TOP_LEVEL_LIMIT)
    expect(labels?.[0]).toBe('第1章')
    expect(labels?.[9]).toBe('第10章')
  })

  it('空目录返回 undefined', () => {
    expect(collectTocTopLevel([])).toBeUndefined()
  })
})
