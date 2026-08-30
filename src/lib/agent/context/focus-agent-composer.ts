import { useAcpUiStore } from '@/stores/acp-ui-store'
import { reviveSelectionNotify } from './reader-selection-registry'

export { SELECTION_CHAT_MARKER, appendSelectionChatMarker } from './selection-chat-marker'

/** 只读阅读器划选后：Agent 面板已打开时才聚焦输入框（Markdown 等勿调用） */
export function focusAgentComposerOnReaderSelection(): void {
  useAcpUiStore.getState().requestComposerFocus()
}

/**
 * 选区工具栏「问 Agent」：强制打开面板并聚焦；
 * 若已有 sticky 选区则重新挂起 hasSelection，便于下一轮必读选区。
 */
export function openAgentComposerToAskSelection(): void {
  reviveSelectionNotify()
  useAcpUiStore.getState().openPanelAndFocusComposer()
}

/**
 * 选区工具栏「加入对话」：开面板、插入短标记，不贴选区正文。
 * sticky 仍保留，发送时 hasSelection + 工具可读真实选区。
 */
export function addSelectionMarkerToComposer(): void {
  reviveSelectionNotify()
  useAcpUiStore.getState().insertComposerSelectionMarker()
}
