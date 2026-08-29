import type { AcpChatMessage } from '@/stores/acp-chat-types'

/** 会话是否「无实质内容」（仅系统消息 / 空数组视为空白，对齐 Cursor 清空会话） */
export function isBlankThreadMessages(messages: AcpChatMessage[]): boolean {
  return !messages.some((m) => {
    if (m.role === 'system') return false
    if (m.role === 'user' || m.role === 'agent' || m.role === 'thought') {
      return m.text.trim().length > 0
    }
    if (m.role === 'tool') return true
    if (m.role === 'plan') {
      return (m.planEntries?.length ?? 0) > 0 || m.text.trim().length > 0
    }
    return false
  })
}

export function isBlankThread(thread: {
  messages: AcpChatMessage[]
}): boolean {
  return isBlankThreadMessages(thread.messages)
}

/**
 * 去掉空白会话；若全空则保留 keepId 或新建占位由调用方处理。
 * keepId 指定时即使空白也保留（例如当前正在编辑的空草稿）。
 */
export function pruneBlankThreads<T extends { id: string; messages: AcpChatMessage[] }>(
  threads: T[],
  options?: { keepId?: string },
): T[] {
  const keepId = options?.keepId
  return threads.filter((t) => t.id === keepId || !isBlankThread(t))
}
