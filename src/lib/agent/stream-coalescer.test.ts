import { describe, expect, it } from 'vitest'
import { StreamCoalescer, isCoalescableAgentChunk } from '@/lib/agent/stream-coalescer'

describe('stream-coalescer', () => {
  it('只合并 agent_message_chunk 纯文本', () => {
    expect(
      isCoalescableAgentChunk({
        sessionUpdate: 'agent_message_chunk',
        content: [{ type: 'text', text: '你好' }],
      }),
    ).toBe('你好')
    expect(
      isCoalescableAgentChunk({ sessionUpdate: 'tool_call', content: 'x' }),
    ).toBeNull()
    expect(isCoalescableAgentChunk({ sessionUpdate: 'agent_message_chunk' })).toBeNull()
  })

  it('push/flush 合并多次小块', () => {
    const c = new StreamCoalescer()
    c.push('a')
    c.push('b')
    expect(c.size).toBe(2)
    expect(c.flush()).toBe('ab')
    expect(c.pending).toBe('')
  })
})
