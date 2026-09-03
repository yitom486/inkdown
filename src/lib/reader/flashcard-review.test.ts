import { describe, expect, it } from 'vitest'
import { calculateReviewStats, parseClozeContent } from './flashcard-review'

describe('flashcard-review', () => {
  it('parses single cloze deletion', () => {
    const raw = 'Vue 3 的核心响应式系统是基于 {{c1::Proxy}} 实现的。'
    const result = parseClozeContent(raw)

    expect(result.answers).toEqual(['Proxy'])
    expect(result.frontText).toContain('[ ❓ 点击翻转查看答案 ]')
    expect(result.backHtml).toContain('<mark')
    expect(result.backHtml).toContain('Proxy</mark>')
  })

  it('parses multiple cloze deletions in one sentence', () => {
    const raw = '在 JVM 中，{{c1::堆内存}} 用于存放对象实例，而 {{c2::方法区}} 用于存放类元信息。'
    const result = parseClozeContent(raw)

    expect(result.answers).toEqual(['堆内存', '方法区'])
    expect(result.frontText).toBe(
      '在 JVM 中， [ ❓ 点击翻转查看答案 ]  用于存放对象实例，而  [ ❓ 点击翻转查看答案 ]  用于存放类元信息。',
    )
    expect(result.backHtml).toContain('堆内存</mark>')
    expect(result.backHtml).toContain('方法区</mark>')
  })

  it('identifies entirely masked highlight and provides a memory clue', () => {
    const raw = '{{c1::《三十·三十书系》，旨在利用香港中文大学独特的双语出版平台，聚集世界范围内的共和国研究。}}'
    const result = parseClozeContent(raw)

    expect(result.isEntirelyMasked).toBe(true)
    expect(result.clue).toContain('《三十·三十书系》')
    expect(result.answers[0]).toBe(
      '《三十·三十书系》，旨在利用香港中文大学独特的双语出版平台，聚集世界范围内的共和国研究。',
    )
  })

  it('calculates review statistics correctly', () => {
    const ratings = {
      card1: 'good' as const,
      card2: 'again' as const,
      card3: 'good' as const,
      card4: 'hard' as const,
    }
    const stats = calculateReviewStats(ratings, 5)

    expect(stats.total).toBe(5)
    expect(stats.reviewed).toBe(4)
    expect(stats.counts.good).toBe(2)
    expect(stats.counts.again).toBe(1)
    expect(stats.counts.hard).toBe(1)
  })
})
