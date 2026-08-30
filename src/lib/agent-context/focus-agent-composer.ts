import { useAcpUiStore } from '@/stores/acp-ui-store'
import { reviveSelectionNotify } from './reader-selection-registry'

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
