import { describe, expect, it } from 'vitest'
import {
  SELECTION_CHAT_MARKER,
  appendSelectionChatMarker,
} from './selection-chat-marker'

describe('appendSelectionChatMarker', () => {
  it('空草稿只写入短标记，不贴选区正文', () => {
    expect(appendSelectionChatMarker('')).toBe(SELECTION_CHAT_MARKER)
    expect(appendSelectionChatMarker('   ')).toBe(SELECTION_CHAT_MARKER)
    expect(appendSelectionChatMarker('')).not.toContain('这段很长的选中文字')
  })

  it('已有正文时在末尾追加，不重复插入', () => {
    expect(appendSelectionChatMarker('解释一下')).toBe(`解释一下 ${SELECTION_CHAT_MARKER}`)
    expect(appendSelectionChatMarker('解释一下 ')).toBe(`解释一下 ${SELECTION_CHAT_MARKER}`)
    expect(appendSelectionChatMarker(`看这段 ${SELECTION_CHAT_MARKER}`)).toBe(
      `看这段 ${SELECTION_CHAT_MARKER}`,
    )
  })
})
