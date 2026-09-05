/** 流式正文合并缓冲：多个小 chunk 合并为一次 store 更新。 */
export const STREAM_FLUSH_MS = 32

export function isCoalescableAgentChunk(update: Record<string, unknown>): string | null {
  const kind = typeof update.sessionUpdate === 'string' ? update.sessionUpdate : ''
  if (kind !== 'agent_message_chunk') return null
  const c = update.content as unknown
  if (typeof c === 'string') return c || null
  if (Array.isArray(c)) {
    const text = c
      .filter((b): b is { type?: unknown; text?: unknown } => typeof b === 'object' && b !== null)
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('')
    return text || null
  }
  if (typeof c === 'object' && c !== null) {
    const b = c as { type?: unknown; text?: unknown }
    return b.type === 'text' && typeof b.text === 'string' ? (b.text as string) || null : null
  }
  return null
}

export class StreamCoalescer {
  private buf = ''
  get pending(): string {
    return this.buf
  }
  push(text: string): void {
    this.buf += text
  }
  flush(): string {
    const out = this.buf
    this.buf = ''
    return out
  }
  get size(): number {
    return this.buf.length
  }
}
