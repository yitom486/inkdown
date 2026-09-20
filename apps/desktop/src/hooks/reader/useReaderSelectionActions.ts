import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  addSelectionMarkerToComposer,
  openAgentComposerToAskSelection,
} from '@/lib/agent/context/focus-agent-composer'
import { copyTextToClipboard } from '@inkdown/reader-core'
import type { HighlightColorId } from '@inkdown/reader-core'
import { useReaderHudUiStore } from '@/stores/acp/reader-hud-store'
import { generateAiCardContent } from '@/lib/agent/card-studio'

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
  /**
   * 制卡会话归属键（本书指纹，缺省回落文件路径，由各 Viewer 传入）。
   * 决定一书一会话落哪一行；缺省仅内存会话（不断流，但重启不恢复）。
   */
  sessionKey?: string
}

export interface ReaderSelectionActions {
  handleCopy: () => void
  handleAnnotate: () => void
  handleHighlight: (color: HighlightColorId) => void
  handleAddToChat: () => void
  handleAskAgent: () => void
  /**
   * AI 制卡（P1 菜单驱动）：选预设 → 本书会话调模型 → 落卡。
   * 离线/无响应回启发式并明示；pending 期间调用方禁用菜单。
   */
  generateAiCard: (presetId: string, customText?: string) => Promise<void>
  aiCardPending: boolean
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
    sessionKey,
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

  const [aiCardPending, setAiCardPending] = useState(false)

  const generateAiCard = useCallback(
    async (presetId: string, customText?: string) => {
      if (hasSelection && !hasSelection()) {
        toast.error('当前没有可用选区，请先划选文本')
        return
      }
      const text = snapshotText ?? ''
      if (!text.trim()) {
        toast.error('选中文本为空')
        return
      }
      // 会话归属键由 Viewer 传入（指纹优先、路径回落）；缺省不断流但无法建卡
      const bookKey = sessionKey?.trim()
      if (!bookKey) {
        toast.error('本书信息缺失，无法制卡')
        return
      }
      setAiCardPending(true)
      try {
        const outcome = await generateAiCardContent({
          excerpt: text,
          presetId,
          customText,
          bookKey,
        })
        if (!outcome) {
          toast.error('制卡参数异常')
          return
        }
        retainSelection?.()
        const { card } = outcome
        try {
          await saveHighlight(
            JSON.stringify({
              title: card.title,
              category: card.category,
              aiSummary: card.aiSummary,
              keyPoints: card.keyPoints,
            }),
            card.color,
          )
        } catch (cause) {
          if (onHighlightError) {
            onHighlightError(cause)
            return
          }
          throw cause
        }
        useReaderHudUiStore.getState().setIsCardRailOpen(true)
        if (outcome.fallback) {
          toast.warning(`AI 无响应，已用启发式制卡【${card.title}】`)
        } else {
          toast.success(`AI 制卡：【${card.title}】`)
        }
        clearTextSelection()
      } catch {
        toast.error('制卡失败，请重试')
      } finally {
        setAiCardPending(false)
      }
    },
    [
      hasSelection,
      snapshotText,
      sessionKey,
      retainSelection,
      saveHighlight,
      onHighlightError,
      clearTextSelection,
    ],
  )

  return {
    handleCopy,
    handleAnnotate,
    handleHighlight,
    handleAddToChat,
    handleAskAgent,
    generateAiCard,
    aiCardPending,
    handleDismiss: clearTextSelection,
  }
}
