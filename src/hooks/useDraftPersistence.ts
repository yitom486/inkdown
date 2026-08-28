import { useEffect } from 'react'
import { getDraftKey } from '@/lib/draft-utils'
import { useDraftStore } from '@/stores/draft-store'

const DRAFT_DEBOUNCE_MS = 500

interface UseDraftPersistenceOptions {
  filePath?: string
  content: string
  savedContent: string
  isDirty: boolean
}

/** 编辑内容 debounce 后写入本地草稿；保存成功或不再 dirty 时清除 */
export function useDraftPersistence({
  filePath,
  content,
  savedContent,
  isDirty,
}: UseDraftPersistenceOptions) {
  const upsertDraft = useDraftStore((state) => state.upsertDraft)
  const removeDraft = useDraftStore((state) => state.removeDraft)
  const draftKey = getDraftKey(filePath)

  useEffect(() => {
    if (!isDirty) {
      removeDraft(draftKey)
      return
    }

    const timer = window.setTimeout(() => {
      upsertDraft({
        filePath,
        content,
        baselineContent: savedContent,
        updatedAt: Date.now(),
      })
    }, DRAFT_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [content, draftKey, filePath, isDirty, removeDraft, savedContent, upsertDraft])
}

export function clearDraftForFile(filePath?: string): void {
  useDraftStore.getState().removeDraft(getDraftKey(filePath))
}
