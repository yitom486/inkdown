/** 崩溃恢复草稿：未命名文档使用固定键 */
export const UNTITLED_DRAFT_KEY = '__untitled__'

export interface DocumentDraft {
  filePath?: string
  content: string
  /** 写入草稿时磁盘上的已保存内容（用于恢复后仍标记 dirty） */
  baselineContent: string
  updatedAt: number
}

export function getDraftKey(filePath?: string): string {
  return filePath ?? UNTITLED_DRAFT_KEY
}

export function isRecoverableDraft(draft: DocumentDraft): boolean {
  return draft.content !== draft.baselineContent
}

export function pickLatestRecoverableDraft(
  drafts: Record<string, DocumentDraft>,
): DocumentDraft | null {
  const recoverable = Object.values(drafts)
    .filter(isRecoverableDraft)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return recoverable[0] ?? null
}

export function getDraftDisplayName(draft: DocumentDraft): string {
  if (draft.filePath) {
    return draft.filePath.split(/[/\\]/).pop() ?? draft.filePath
  }
  return '未命名文档'
}
