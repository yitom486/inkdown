import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import type { MarkdownEditorHandle } from '@/components/editor/MarkdownEditor'
import type { PreviewPaneHandle } from '@/components/preview/PreviewPane'
import type { MarkdownHeading } from '@/lib/markdown-headings'
import { useEditorUiStore, useFileUiState, type EditorViewMode } from '@/stores/editor-ui-store'

const SYNC_LOCK_MS = 120

interface UseScrollSyncOptions {
  filePath?: string
  viewMode: EditorViewMode
  /** 预览 HTML 更新后需重新对齐滚动条进度 */
  previewHtml?: string
  editorRef: RefObject<MarkdownEditorHandle | null>
  previewRef: RefObject<PreviewPaneHandle | null>
}

export function useScrollSync({
  filePath,
  viewMode,
  previewHtml,
  editorRef,
  previewRef,
}: UseScrollSyncOptions) {
  const saveScrollState = useEditorUiStore((state) => state.saveScrollState)
  const fileState = useFileUiState(filePath)
  const syncingRef = useRef<'editor' | 'preview' | null>(null)
  const persistTimerRef = useRef<number | undefined>(undefined)

  const persistScroll = useCallback(() => {
    window.clearTimeout(persistTimerRef.current)
    persistTimerRef.current = window.setTimeout(() => {
      saveScrollState(
        filePath,
        editorRef.current?.getScrollRatio() ?? 0,
        previewRef.current?.getScrollRatio() ?? 0,
      )
    }, 200)
  }, [editorRef, filePath, previewRef, saveScrollState])

  const releaseSyncLock = useCallback((source: 'editor' | 'preview') => {
    window.setTimeout(() => {
      if (syncingRef.current === source) {
        syncingRef.current = null
      }
    }, SYNC_LOCK_MS)
  }, [])

  /** 按滚动条进度（0~1）同步：左侧 100% → 右侧也 100% */
  const syncEditorToPreview = useCallback(() => {
    if (syncingRef.current === 'preview') return

    syncingRef.current = 'editor'
    const editor = editorRef.current
    const preview = previewRef.current
    if (!editor || !preview) {
      syncingRef.current = null
      return
    }

    preview.setScrollRatio(editor.getScrollRatio())
    persistScroll()
    releaseSyncLock('editor')
  }, [editorRef, persistScroll, previewRef, releaseSyncLock])

  const syncPreviewToEditor = useCallback(() => {
    if (syncingRef.current === 'editor') return

    syncingRef.current = 'preview'
    const editor = editorRef.current
    const preview = previewRef.current
    if (!editor || !preview) {
      syncingRef.current = null
      return
    }

    editor.setScrollRatio(preview.getScrollRatio())
    persistScroll()
    releaseSyncLock('preview')
  }, [editorRef, persistScroll, previewRef, releaseSyncLock])

  const restoreScroll = useCallback(() => {
    requestAnimationFrame(() => {
      editorRef.current?.setScrollRatio(fileState.editorScrollRatio)
      previewRef.current?.setScrollRatio(fileState.previewScrollRatio)
    })
  }, [editorRef, fileState.editorScrollRatio, fileState.previewScrollRatio, previewRef])

  useEffect(() => {
    restoreScroll()
  }, [filePath, restoreScroll])

  // 预览重新渲染会重置 scrollTop，按编辑器当前进度条位置重新对齐
  useEffect(() => {
    if (viewMode !== 'split' || !previewHtml) return

    const frame = requestAnimationFrame(() => {
      if (syncingRef.current === 'preview') return
      const editor = editorRef.current
      const preview = previewRef.current
      if (!editor || !preview) return
      preview.setScrollRatio(editor.getScrollRatio())
    })

    return () => cancelAnimationFrame(frame)
  }, [previewHtml, viewMode, editorRef, previewRef])

  useEffect(() => {
    return () => {
      window.clearTimeout(persistTimerRef.current)
      saveScrollState(
        filePath,
        editorRef.current?.getScrollRatio() ?? 0,
        previewRef.current?.getScrollRatio() ?? 0,
      )
    }
  }, [editorRef, filePath, previewRef, saveScrollState])

  const scrollHandlers = useMemo(
    () =>
      viewMode === 'split'
        ? {
            onEditorScroll: syncEditorToPreview,
            onPreviewScroll: syncPreviewToEditor,
          }
        : {
            onEditorScroll: persistScroll,
            onPreviewScroll: persistScroll,
          },
    [persistScroll, syncEditorToPreview, syncPreviewToEditor, viewMode],
  )

  const jumpToHeading = useCallback(
    (heading: MarkdownHeading) => {
      syncingRef.current = 'editor'

      if (viewMode !== 'preview') {
        editorRef.current?.scrollToLine(heading.line)
      }
      if (viewMode !== 'editor') {
        previewRef.current?.scrollToHeading(heading.id)
      }

      persistScroll()
      releaseSyncLock('editor')
    },
    [editorRef, persistScroll, previewRef, releaseSyncLock, viewMode],
  )

  return {
    ...scrollHandlers,
    jumpToHeading,
    restoreScroll,
  }
}
