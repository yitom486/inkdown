import { describe, expect, it } from 'vitest'
import { findUnbalancedBrackets } from './codemirror-syntax-linter'

describe('findUnbalancedBrackets', () => {
  it('配对括号无诊断', () => {
    expect(findUnbalancedBrackets('function main() { return 1 }', 0)).toEqual([])
  })

  it('检测未闭合左括号', () => {
    const result = findUnbalancedBrackets('function main() {', 0)
    expect(result).toHaveLength(1)
    expect(result[0]?.message).toContain('未闭合')
    expect(result[0]?.severity).toBe('warning')
  })

  it('检测多余右括号', () => {
    const result = findUnbalancedBrackets('})', 0)
    expect(result.some((item) => item.message.includes("多余的 '}'"))).toBe(true)
  })
})
