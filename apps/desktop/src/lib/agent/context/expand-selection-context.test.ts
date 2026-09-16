import { describe, expect, it } from 'vitest'
import { buildSelectionContext, findSelectionIndex } from './expand-selection-context'

describe('findSelectionIndex', () => {
  it('精确匹配', () => {
    expect(findSelectionIndex('abc def ghi', 'def')).toBe(4)
  })
})

describe('buildSelectionContext', () => {
  const parent = '开头部分的内容在这里，中间是目标词，后面还有更多说明文字。'

  it('长选区不扩展', () => {
    const selection = '这是一段明显超过三十个字的选区内容，用来验证长选区不会触发向前后扩展的逻辑。'
    const result = buildSelectionContext(selection, `${selection}后面还有`, 30)
    expect(result.expanded).toBe(false)
    expect(result.excerpt).toBe(selection)
  })

  it('短选区向前后各补约 30 字', () => {
    const result = buildSelectionContext('目标词', parent, 30, 5)
    expect(result.expanded).toBe(true)
    expect(result.selection).toBe('目标词')
    expect(result.excerpt).toContain('目标词')
    expect(result.excerpt.length).toBeGreaterThan('目标词'.length)
  })
})
