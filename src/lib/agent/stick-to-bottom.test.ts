// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import {
  isNearBottom,
  rafCoalesce,
  shouldRePinOnMessageChange,
} from './stick-to-bottom'

describe('stick-to-bottom', () => {
  it('isNearBottom 在距底部阈值内返回 true', () => {
    expect(isNearBottom({ scrollTop: 900, scrollHeight: 1000, clientHeight: 50 }, 96)).toBe(true)
    expect(isNearBottom({ scrollTop: 800, scrollHeight: 1000, clientHeight: 50 }, 96)).toBe(false)
  })

  it('shouldRePinOnMessageChange 在新消息或流式开始时贴底', () => {
    const base = { messageCount: 2, lastMessageId: 'a', lastMessageStreaming: false, prompting: false }
    expect(
      shouldRePinOnMessageChange(base, { ...base, messageCount: 3 }),
    ).toBe(true)
    expect(
      shouldRePinOnMessageChange(base, { ...base, lastMessageId: 'b' }),
    ).toBe(true)
    expect(
      shouldRePinOnMessageChange(base, { ...base, lastMessageStreaming: true }),
    ).toBe(true)
    expect(
      shouldRePinOnMessageChange(base, { ...base, prompting: true }),
    ).toBe(true)
    expect(
      shouldRePinOnMessageChange(
        { ...base, lastMessageStreaming: true },
        { ...base, lastMessageStreaming: true },
      ),
    ).toBe(false)
  })

  it('rafCoalesce 同一帧内只执行一次', async () => {
    const spy = vi.fn()
    const schedule = rafCoalesce(spy)
    schedule()
    schedule()
    schedule()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
