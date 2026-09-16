import { describe, expect, it } from 'vitest'
import {
  normalizeLatexDelimiters,
  patchStreamingMathDelimiters,
} from './latex-delimiters'

describe('normalizeLatexDelimiters', () => {
  it('将 \\[...\\] 转为 $$...$$', () => {
    const input = String.raw`\[A-B = A + B\]`
    expect(normalizeLatexDelimiters(input)).toBe('$$A-B = A + B$$')
  })

  it('将 \\(...\\) 转为 $...$', () => {
    const input = String.raw`行内 \(E=mc^2\) 公式`
    expect(normalizeLatexDelimiters(input)).toBe('行内 $E=mc^2$ 公式')
  })

  it('将含 LaTeX 命令的裸括号转为 $...$', () => {
    const input = String.raw`- (A+\sim B+1)`
    expect(normalizeLatexDelimiters(input)).toBe(String.raw`- $A+\sim B+1$`)
  })

  it('不误伤 Windows 路径等反斜杠文本', () => {
    const input = String.raw`保存到 (C:\Users\test) 目录`
    expect(normalizeLatexDelimiters(input)).toBe(input)
  })

  it('跳过 fenced code 内的定界符', () => {
    const input = ['```ts', String.raw`const x = '\[not math\]'`, '```', String.raw`\[a+b\]`,].join('\n')
    expect(normalizeLatexDelimiters(input)).toContain(String.raw`'\[not math\]'`)
    expect(normalizeLatexDelimiters(input)).toContain('$$a+b$$')
  })

  it('跳过行内 code 内的裸括号', () => {
    const input = '见 `(A+\\sim B+1)` 示例'
    expect(normalizeLatexDelimiters(input)).toBe(input)
  })
})

describe('patchStreamingMathDelimiters', () => {
  it('临时闭合未完成的 $$ 块', () => {
    expect(patchStreamingMathDelimiters(String.raw`$$\frac{a}{b`)).toBe(
      String.raw`$$\frac{a}{b` + '\n$$',
    )
  })

  it('临时闭合未完成的行内 $', () => {
    expect(patchStreamingMathDelimiters('公式 $E=mc^2')).toBe('公式 $E=mc^2$')
  })

  it('临时闭合未完成的 \\[ 块', () => {
    const input = String.raw`\[\begin{aligned} A`
    const output = patchStreamingMathDelimiters(input)
    expect(output).toBe(`${input}\n\\]`)
  })

  it('已闭合时不改动', () => {
    const input = '行内 $E=mc^2$ 与 $$\\frac{a}{b}$$'
    expect(patchStreamingMathDelimiters(input)).toBe(input)
  })
})
