/** 多级目录中，底部「上一章/下一章」在 pickReaderNavLevel 选定的层级间切换 */

export interface LeveledChapter {
  level: number
}

export function pickReaderNavLevel<T extends LeveledChapter>(
  chapters: T[],
  isTocLike: (chapter: T) => boolean,
): number {
  const navigable = chapters.filter((chapter) => !isTocLike(chapter))
  if (navigable.length === 0) return 0

  const countByLevel = new Map<number, number>()
  for (const chapter of navigable) {
    countByLevel.set(chapter.level, (countByLevel.get(chapter.level) ?? 0) + 1)
  }

  const levels = [...countByLevel.keys()].sort((a, b) => a - b)
  for (const level of levels) {
    if ((countByLevel.get(level) ?? 0) >= 2) return level
  }

  return navigable[navigable.length - 1]!.level
}

export function findAnchorLevelIndex<T extends LeveledChapter>(
  chapters: T[],
  flatIndex: number,
  navLevel: number,
): number {
  if (flatIndex < 0) return -1
  for (let i = flatIndex; i >= 0; i -= 1) {
    const chapter = chapters[i]!
    if (chapter.level === navLevel) return i
    if (chapter.level < navLevel) return -1
  }
  return -1
}

export function findPreviousNavChapter<T extends LeveledChapter>(
  chapters: T[],
  anchorIndex: number,
  navLevel: number,
  isTocLike?: (chapter: T) => boolean,
): T | null {
  if (anchorIndex < 0) return null
  for (let i = anchorIndex - 1; i >= 0; i -= 1) {
    const chapter = chapters[i]!
    if (chapter.level !== navLevel) continue
    if (isTocLike?.(chapter)) continue
    return chapter
  }
  return null
}

export function findNextNavChapter<T extends LeveledChapter>(
  chapters: T[],
  anchorIndex: number,
  navLevel: number,
  isTocLike?: (chapter: T) => boolean,
): T | null {
  if (anchorIndex < 0) return null
  for (let i = anchorIndex + 1; i < chapters.length; i += 1) {
    const chapter = chapters[i]!
    if (chapter.level !== navLevel) continue
    if (isTocLike?.(chapter)) continue
    return chapter
  }
  return null
}

export function resolveReaderChapterNav<T extends LeveledChapter>(
  chapters: T[],
  flatIndex: number,
  navLevel: number,
  isTocLike?: (chapter: T) => boolean,
): {
  current: T | null
  previous: T | null
  next: T | null
  currentIndex: number
  flatIndex: number
} {
  const anchorIndex = findAnchorLevelIndex(chapters, flatIndex, navLevel)
  const current = anchorIndex >= 0 ? chapters[anchorIndex]! : null
  return {
    current,
    previous: findPreviousNavChapter(chapters, anchorIndex, navLevel, isTocLike),
    next: findNextNavChapter(chapters, anchorIndex, navLevel, isTocLike),
    currentIndex: anchorIndex,
    flatIndex,
  }
}

/** @deprecated 请使用 resolveReaderChapterNav(chapters, flatIndex, 0) */
export function findTopLevelIndex<T extends LeveledChapter>(
  chapters: T[],
  flatIndex: number,
): number {
  return findAnchorLevelIndex(chapters, flatIndex, 0)
}

/** @deprecated 请使用 resolveReaderChapterNav */
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
  return resolveReaderChapterNav(chapters, flatIndex, 0)
}

/** MOBI/AZW3：同一 spine 章节可对应多个 TOC 项，取最后一个匹配项 */
export function findLastFlatIndexById<T extends LeveledChapter & { id: string }>(
  chapters: T[],
  currentId?: string,
): number {
  if (!currentId) return -1
  for (let i = chapters.length - 1; i >= 0; i -= 1) {
    if (chapters[i]!.id === currentId) return i
  }
  return -1
}

/** @deprecated 请使用 findLastFlatIndexById */
export const findLastMobiFlatIndex = findLastFlatIndexById
