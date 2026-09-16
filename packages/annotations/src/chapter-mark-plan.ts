/** 章级划重点建议（用户点选后再读章 + propose_mark）。 */

export type ChapterMarkPlanEntryStatus = 'pending' | 'selected' | 'dismissed'

export interface ChapterMarkPlanEntry {
  id: string
  /** 阅读器扁平目录下标，不是印刷页码 */
  flatIndex: number
  title: string
  reason: string
  status: ChapterMarkPlanEntryStatus
}

/** Agent 工具吐出的一章；尚未生成客户端 id */
export interface ChapterMarkPlanInput {
  flatIndex: number
  title: string
  reason: string
}

export const CHAPTER_MARK_PLAN_MAX = 5

export interface ChapterMarkPlanToolResult {
  suggested: true
  count: number
  chapters: ChapterMarkPlanInput[]
  message: string
}

export function toChapterMarkPlanEntry(
  input: ChapterMarkPlanInput,
  id?: string,
): ChapterMarkPlanEntry {
  return {
    id: id ?? `chapter-plan-${input.flatIndex}-${Date.now().toString(36)}`,
    flatIndex: input.flatIndex,
    title: input.title.trim(),
    reason: input.reason.trim(),
    status: 'pending',
  }
}
