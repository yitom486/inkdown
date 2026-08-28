/** 多级目录中，底部「上一章/下一章」仅在一级标题（level 0）间切换 */

export interface LeveledChapter {
  level: number
}

export function findTopLevelIndex<T extends LeveledChapter>(
  chapters: T[],
  flatIndex: number,
): number {
  if (flatIndex < 0) return -1
  for (let i = flatIndex; i >= 0; i -= 1) {
    if (chapters[i]!.level === 0) return i
  }
  return -1
}

export function findPreviousTopLevelChapter<T extends LeveledChapter>(
  chapters: T[],
  topLevelIndex: number,
): T | null {
  if (topLevelIndex < 0) return null
  for (let i = topLevelIndex - 1; i >= 0; i -= 1) {
    if (chapters[i]!.level === 0) return chapters[i]!
  }
  return null
}

export function findNextTopLevelChapter<T extends LeveledChapter>(
  chapters: T[],
  topLevelIndex: number,
): T | null {
  if (topLevelIndex < 0) return null
  for (let i = topLevelIndex + 1; i < chapters.length; i += 1) {
    if (chapters[i]!.level === 0) return chapters[i]!
  }
  return null
}

export function resolveTopLevelChapterNav<T extends LeveledChapter>(
  chapters: T[],
  flatIndex: number,
): {
  current: T | null
  previous: T | null
  next: T | null
  currentIndex: number
  flatIndex: number
} {
  const topLevelIndex = findTopLevelIndex(chapters, flatIndex)
  const current = topLevelIndex >= 0 ? chapters[topLevelIndex]! : null
  return {
    current,
    previous: findPreviousTopLevelChapter(chapters, topLevelIndex),
    next: findNextTopLevelChapter(chapters, topLevelIndex),
    currentIndex: topLevelIndex,
    flatIndex,
  }
}

/** MOBI/AZW3：同一 spine 章节可对应多个 TOC 项，取最后一个匹配项 */
export function findLastMobiFlatIndex<T extends LeveledChapter & { id: string }>(
  chapters: T[],
  currentId?: string,
): number {
  if (!currentId) return -1
  for (let i = chapters.length - 1; i >= 0; i -= 1) {
    if (chapters[i]!.id === currentId) return i
  }
  return -1
}
