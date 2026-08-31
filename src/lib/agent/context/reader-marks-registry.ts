export interface CreateMarkAtParams {
  excerpt: string
  note: string
  flatIndex?: number
}

export interface ReaderMarksProvider {
  filePath: string
  /** 在当前阅读位置创建书签（不跳转） */
  createBookmark: () => Promise<import('@shared/types/reading-mark').ReadingMark>
  /**
   * 基于当前选区（或 sticky 选区快照）创建批注/高亮。
   * note 为空时创建 highlight。
   */
  createNoteFromSelection: (note: string) => Promise<import('@shared/types/reading-mark').ReadingMark>
  /** 按摘录在章/视口 DOM 内定位并创建标记（无 fresh 选区） */
  createMarkAt: (params: CreateMarkAtParams) => Promise<import('@shared/types/reading-mark').ReadingMark>
}

let current: ReaderMarksProvider | null = null

export function registerReaderMarks(provider: ReaderMarksProvider): () => void {
  current = provider
  return () => {
    if (current === provider) current = null
  }
}

export function getReaderMarksProvider(): ReaderMarksProvider | null {
  return current
}
