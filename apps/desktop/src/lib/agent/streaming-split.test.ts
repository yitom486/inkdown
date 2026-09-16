import { describe, expect, it } from 'vitest'
import { findStableBoundary, isInsideFence, splitStableTail } from '@/lib/agent/streaming-split'

describe('streaming-split', () => {
  it('普通段落边界可冻结', () => {
    const { stable, tail } = splitStableTail('第一段。\n\n第二段生成中')
    expect(stable).toBe('第一段。\n\n')
    expect(tail).toBe('第二段生成中')
  })

  it('围栏内不切分', () => {
    expect(isInsideFence('```ts\ncode\n')).toBe(true)
    expect(findStableBoundary('```ts\npara1\n\npara2\n')).toBe(0)
  })

  it('围栏闭合后可切', () => {
    const text = '```ts\ncode\n```\n\n后面正文'
    const { stable, tail } = splitStableTail(text)
    expect(stable.length).toBeGreaterThan(0)
    expect(stable + tail).toBe(text)
  })

  it('数学公式未闭合时整段不稳定', () => {
    expect(findStableBoundary('前文\n\n$$x+1')).toBe(0)
  })
})
