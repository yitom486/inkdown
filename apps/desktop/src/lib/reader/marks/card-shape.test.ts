import { describe, expect, it } from 'vitest'
import { highlightColorForCategory } from './card-shape'

describe('highlightColorForCategory', () => {
  it('五分类各有固定高亮色（模型不定色，单源）', () => {
    expect(highlightColorForCategory('concept')).toBe('blue')
    expect(highlightColorForCategory('quote')).toBe('yellow')
    expect(highlightColorForCategory('method')).toBe('green')
    expect(highlightColorForCategory('diagram')).toBe('pink')
    expect(highlightColorForCategory('question')).toBe('orange')
  })
})
