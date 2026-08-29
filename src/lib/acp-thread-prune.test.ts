import { describe, expect, it } from 'vitest'
import {
  isBlankThread,
  isBlankThreadMessages,
  pruneBlankThreads,
} from './acp-thread-prune'
import type { AcpChatMessage } from '@/stores/acp-chat-types'

function msg(
  partial: Pick<AcpChatMessage, 'role' | 'text'> & Partial<AcpChatMessage>,
): AcpChatMessage {
  return {
    id: 'm1',
    createdAt: 1,
    ...partial,
  }
}

describe('acp-thread-prune', () => {
  it('treats empty and system-only threads as blank', () => {
    expect(isBlankThreadMessages([])).toBe(true)
    expect(
      isBlankThreadMessages([msg({ role: 'system', text: '已连接' })]),
    ).toBe(true)
  })

  it('treats user/agent content as non-blank', () => {
    expect(
      isBlankThread({ messages: [msg({ role: 'user', text: '你好' })] }),
    ).toBe(false)
    expect(
      isBlankThread({ messages: [msg({ role: 'agent', text: '答复' })] }),
    ).toBe(false)
  })

  it('prunes blank threads but can keep one id', () => {
    const threads = [
      { id: 'a', messages: [] as AcpChatMessage[] },
      { id: 'b', messages: [msg({ role: 'user', text: '有内容' })] },
      { id: 'c', messages: [msg({ role: 'system', text: '仅系统' })] },
    ]
    expect(pruneBlankThreads(threads).map((t) => t.id)).toEqual(['b'])
    expect(pruneBlankThreads(threads, { keepId: 'a' }).map((t) => t.id)).toEqual([
      'a',
      'b',
    ])
  })
})
