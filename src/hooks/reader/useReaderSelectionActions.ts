import { useCallback } from 'react'
import { toast } from 'sonner'
import {
  addSelectionMarkerToComposer,
  openAgentComposerToAskSelection,
} from '@/lib/agent/context/focus-agent-composer'
import { copyTextToClipboard } from '@/lib/reader/pdf-selection'
import type { HighlightColorId } from '@/lib/reader/reading-mark-colors'

/**
 * 三阅读器（PDF / Foliate / WebDoc）划选工具条的共享动作。
 * 只收敛六个按钮行为；选区快照的读取、批注落盘（anchor 各异）仍归各 Viewer。
 */
export interface ReaderSelectionActionsOptions {
  snapshotText: string | null | undefined
  dimTextSelection: () => void
  clearTextSelection: () => void
  /** 打开批注对话框：各家都是清编辑态 + 开弹窗 + 收工具条 */
  openAnnotateDialog: () => void
  /** 写批注时的临时高亮（Foliate/WebDoc 有，PDF 无） */
  showPendingHighlight?: () => void
  /** 批注前置检查（默认快照非空）；PDF 用选区事务判定 */
  hasSelection?: () => boolean
  /** 动作前重申选区归属；PDF 用来回填选区事务 */
  retainSelection?: () => void
  /** 各 Viewer 的 handleSaveAnnotation(note, color)：抛错表示无可用选区 */
  saveHighlight: (note: string, color: HighlightColorId) => Promise<unknown>
  /** 高亮失败回调；不传则保持原样（rejection 不吞） */
  onHighlightError?: (cause: unknown) => void
}

export interface ReaderSelectionActions {
  handleCopy: () => void
  handleAnnotate: () => void
  handleHighlight: (color: HighlightColorId) => void
  handleAddToChat: () => void
  handleAskAgent: () => void
  handleDismiss: () => void
}

export function useReaderSelectionActions(
  options: ReaderSelectionActionsOptions,
): ReaderSelectionActions {
  const {
    snapshotText,
    dimTextSelection,
    clearTextSelection,
    openAnnotateDialog,
    showPendingHighlight,
    hasSelection,
    retainSelection,
    saveHighlight,
    onHighlightError,
  } = options

  // 对齐系统 Ctrl+C：复制后保留选区与工具条（Escape / 点空白仍清）
  const handleCopy = useCallback(() => {
    void copyTextToClipboard(snapshotText ?? '').then((ok) => {
      if (ok) toast.success('已复制')
    })
  }, [snapshotText])

  const handleAnnotate = useCallback(() => {
    if (hasSelection && !hasSelection()) {
      toast.error('当前没有可用选区，请先划选文本')
      return
    }
    retainSelection?.()
    openAnnotateDialog()
    showPendingHighlight?.()
  }, [hasSelection, retainSelection, openAnnotateDialog, showPendingHighlight])

  const handleHighlight = useCallback(
    (color: HighlightColorId) => {
      retainSelection?.()
      const pending = saveHighlight('', color)
      // 有回调才挂 catch：无回调时保持调用方原有的 rejection 语义
      if (onHighlightError) {
        void pending.catch(onHighlightError)
      } else {
        void pending
      }
    },
    [retainSelection, saveHighlight, onHighlightError],
  )

  const handleAddToChat = useCallback(() => {
    addSelectionMarkerToComposer()
    dimTextSelection()
  }, [dimTextSelection])

  const handleAskAgent = useCallback(() => {
    openAgentComposerToAskSelection()
    dimTextSelection()
  }, [dimTextSelection])

  return {
    handleCopy,
    handleAnnotate,
    handleHighlight,
    handleAddToChat,
    handleAskAgent,
    handleDismiss: clearTextSelection,
  }
}
