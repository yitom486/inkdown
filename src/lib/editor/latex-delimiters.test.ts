import { describe, expect, it } from 'vitest'
import { normalizeLatexDelimiters } from './latex-delimiters'

describe('normalizeLatexDelimiters', () => {
  it('将 \\[...\\] 转为 $$...$$', () => {
    const input = String.raw`\[A-B = A + B\]`
    expect(normalizeLatexDelimiters(input)).toBe('$$A-B = A + B$$')
  })

  it('将 \\(...\\) 转为 $...$', () => {
    const input = String.raw`行内 \(E=mc^2\) 公式`
    expect(normalizeLatexDelimiters(input)).toBe('行内 $E=mc^2$ 公式')
  })

  it('跳过 fenced code 内的定界符', () => {
    const input = ['```ts', String.raw`const x = '\[not math\]'`, '```', String.raw`\[a+b\]`,].join('\n')
    expect(normalizeLatexDelimiters(input)).toContain(String.raw`'\[not math\]'`)
    expect(normalizeLatexDelimiters(input)).toContain('$$a+b$$')
  })
})
