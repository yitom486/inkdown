import { useAcpUiStore } from '@/stores/acp-ui-store'

/** 只读阅读器划选后：Agent 面板已打开时才聚焦输入框（Markdown 等勿调用） */
export function focusAgentComposerOnReaderSelection(): void {
  useAcpUiStore.getState().requestComposerFocus()
}
