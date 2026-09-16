import { describe, expect, it } from 'vitest'
import {
  adaptiveCps,
  countGraphemes,
  nextRevealLength,
  sliceGraphemes,
} from '@/hooks/agent/useSmoothStreamingText'

describe('smooth streaming reveal', () => {
  it('按 dt 推进且不超过目标', () => {
    expect(nextRevealLength(0, 10, 16, 480)).toBeGreaterThanOrEqual(1)
    expect(nextRevealLength(95, 100, 16, 480)).toBe(100)
    expect(nextRevealLength(100, 100, 16, 480)).toBe(100)
  })

  it('自适应速度：余量健康跟随输入，积压过大封顶', () => {
    expect(adaptiveCps(0, 200)).toBe(0)
    const healthy = adaptiveCps(5, 200)
    expect(healthy).toBeGreaterThanOrEqual(180)
    expect(healthy).toBeLessThanOrEqual(1200)
    expect(adaptiveCps(10_000, 200)).toBe(1200)
  })

  it('不拆坏 emoji 字符簇', () => {
    const text = 'a👨‍👩‍👧b'
    expect(sliceGraphemes(text, 1)).toBe('a')
    expect(countGraphemes('👨‍👩‍👧')).toBe(1)
    expect(sliceGraphemes(text, countGraphemes(text))).toBe(text)
  })
})
