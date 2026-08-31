// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  collapseInlineWhitespace,
  excerptAppearsIn,
  excerptSearchCandidates,
  findExcerptInText,
  findTextRangeInRoot,
} from '@/lib/reader/excerpt-text-match'

describe('excerpt-text-match', () => {
  it('collapseInlineWhitespace 折叠连续空白', () => {
    expect(collapseInlineWhitespace('  hello   world  ')).toBe('hello world')
  })

  it('excerptSearchCandidates 含原文与折叠版', () => {
    expect(excerptSearchCandidates('a  b')).toEqual(['a  b', 'a b'])
    expect(excerptSearchCandidates('plain')).toEqual(['plain'])
  })

  it('excerptAppearsIn 忽略空白差异', () => {
    const haystack = 'Line one\n\nLine two with   spaces'
    expect(excerptAppearsIn(haystack, 'Line two with spaces')).toBe(true)
    expect(excerptAppearsIn(haystack, 'missing')).toBe(false)
  })

  it('findTextRangeInRoot 在 DOM 中定位摘录', () => {
    const root = document.createElement('div')
    root.textContent = 'Alpha beta gamma delta'
    document.body.appendChild(root)

    const range = findTextRangeInRoot(root, 'beta gamma')
    expect(range?.toString()).toBe('beta gamma')

    root.remove()
  })

  it('findExcerptInText 模糊匹配口述 hint', () => {
    const text =
      'Java 语言具有跨平台特性，广泛应用于互联网、金融、能源等领域，适合企业级开发。'
    const match = findExcerptInText(text, '如互联网能源')
    expect(match?.confidence).toBe('fuzzy')
    expect(match?.excerpt).toContain('互联网')
    expect(match?.excerpt).toContain('能源')
  })

  it('findExcerptInText 精确匹配优先', () => {
    const text = '第一段。第二段含互联网、金融、能源。第三段。'
    const match = findExcerptInText(text, '互联网、金融、能源')
    expect(match?.confidence).toBe('exact')
    expect(match?.excerpt).toBe('互联网、金融、能源')
  })
})
