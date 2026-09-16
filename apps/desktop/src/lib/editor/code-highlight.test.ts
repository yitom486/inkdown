import { describe, expect, it } from 'vitest'
import { highlightCode, normalizeHighlightLanguage } from './code-highlight'

describe('code-highlight', () => {
  it('规范化常见语言别名', () => {
    expect(normalizeHighlightLanguage('ts')).toBe('typescript')
    expect(normalizeHighlightLanguage('js')).toBe('javascript')
    expect(normalizeHighlightLanguage('py')).toBe('python')
    expect(normalizeHighlightLanguage('')).toBe('plaintext')
  })

  it('为 TypeScript 代码生成 hljs 标记', () => {
    const html = highlightCode('const value: number = 1', 'typescript')

    expect(html).toContain('hljs-keyword')
    expect(html).toContain('hljs-number')
  })

  it('为未知语言回退到自动检测', () => {
    const html = highlightCode('function demo() {}', 'unknown-lang')

    expect(html).toContain('hljs-keyword')
    expect(html).toContain('hljs-title')
  })

  it('保留纯文本内容', () => {
    const html = highlightCode('hello world', 'plaintext')

    expect(html).toContain('hello world')
  })
})
