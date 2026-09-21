// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import {
  CHAT_HISTORY_INITIAL_COUNT,
  CHAT_HISTORY_PAGE_STEP,
  isNearBottom,
  rafCoalesce,
  shouldRePinOnMessageChange,
  sliceChatWindow,
} from './stick-to-bottom'

describe('stick-to-bottom', () => {
  it('isNearBottom 在距底部阈值内返回 true', () => {
    expect(isNearBottom({ scrollTop: 900, scrollHeight: 1000, clientHeight: 50 }, 96)).toBe(true)
    expect(isNearBottom({ scrollTop: 800, scrollHeight: 1000, clientHeight: 50 }, 96)).toBe(false)
  })

  it('shouldRePinOnMessageChange 在新消息或流式开始时贴底', () => {
    const base = { messageCount: 2, lastMessageId: 'a', lastMessageStreaming: false, prompting: false }
    // 末尾追加（条数涨 + 末条变）：贴底
    expect(
      shouldRePinOnMessageChange(base, { ...base, messageCount: 3, lastMessageId: 'b' }),
    ).toBe(true)
    // 历史前补（条数涨 + 末条不变）：不贴底，否则懒加载一次拽回一次
    expect(
      shouldRePinOnMessageChange(base, { ...base, messageCount: 7 }),
    ).toBe(false)
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

  it('历史分页常量：初 5 步 5', () => {
    expect(CHAT_HISTORY_INITIAL_COUNT).toBe(5)
    expect(CHAT_HISTORY_PAGE_STEP).toBe(5)
  })

  it('sliceChatWindow：贴底取末尾，冻结窗口移位稳定', () => {
    const messages = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']
    // 贴底：末 3 条；新消息自然进入
    expect(sliceChatWindow(messages, null, 3)).toEqual(['m6', 'm7', 'm8'])
    expect(sliceChatWindow([...messages, 'm9'], null, 3)).toEqual(['m7', 'm8', 'm9'])
    // 冻结：[2, 5) 不随新消息移位
    expect(sliceChatWindow(messages, 2, 3)).toEqual(['m3', 'm4', 'm5'])
    expect(sliceChatWindow([...messages, 'm9'], 2, 3)).toEqual(['m3', 'm4', 'm5'])
    // 越界钳制与总量不足
    expect(sliceChatWindow(messages, 100, 3)).toEqual(['m8'])
    expect(sliceChatWindow(['a', 'b'], null, 5)).toEqual(['a', 'b'])
    expect(sliceChatWindow(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })
})
