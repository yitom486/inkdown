import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HIGHLIGHT_COLOR,
  highlightFill,
  highlightSwatch,
  normalizeHighlightColor,
} from './reading-mark-colors'

describe('reading-mark-colors', () => {
  it('默认与未知值都回落到黄色', () => {
    expect(normalizeHighlightColor()).toBe(DEFAULT_HIGHLIGHT_COLOR)
    expect(normalizeHighlightColor('yellow')).toBe('yellow')
    expect(normalizeHighlightColor('#ff0')).toBe('yellow')
    expect(highlightSwatch()).toBe('#facc15')
  })

  it('暗色/亮色都使用半透明填充，避免盖住文字', () => {
    for (const theme of ['light', 'dark'] as const) {
      const fill = highlightFill('yellow', theme)
      expect(fill).toMatch(/^rgba\(/)
      const alpha = Number(fill.slice(fill.lastIndexOf(',') + 1, -1).trim())
      expect(alpha).toBeGreaterThan(0)
      expect(alpha).toBeLessThanOrEqual(0.4)
    }
  })
})
