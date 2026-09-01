import { describe, expect, it } from 'vitest'
import {
  isNearBottom,
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
})
