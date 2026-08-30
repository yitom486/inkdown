import type { ReadingMark } from '@shared/types/reading-mark'

export interface ReaderMarksProvider {
  filePath: string
  /** 在当前阅读位置创建书签（不跳转） */
  createBookmark: () => Promise<ReadingMark>
  /**
   * 基于当前选区（或 sticky 选区快照）创建批注/高亮。
   * note 为空时创建 highlight。
   */
  createNoteFromSelection: (note: string) => Promise<ReadingMark>
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
