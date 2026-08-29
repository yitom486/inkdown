/** 多级目录：底部导航在展平 TOC 中逐步切换；可选按 load key 去重（MOBI 同 spine） */

export interface LeveledChapter {
  level: number
}

export interface AdjacentFlatNavOptions<T extends LeveledChapter> {
  isTocLike?: (chapter: T) => boolean
  /** 加载目标 key；相同时仅更新目录位置而不重新加载（如 MOBI spine id） */
  getLoadTargetKey?: (chapter: T) => string
  /** 相邻节过滤（如 EPUB 同文件父级目录项） */
  shouldSkipAdjacent?: (current: T, candidate: T) => boolean
}

export interface AdjacentFlatNavState<T extends LeveledChapter> {
  current: T | null
  previous: T | null
  next: T | null
  currentIndex: number
  previousIndex: number
  nextIndex: number
  flatIndex: number
}

const EMPTY_ADJACENT_NAV = {
  current: null,
  previous: null,
  next: null,
  currentIndex: -1,
  previousIndex: -1,
  nextIndex: -1,
  flatIndex: -1,
}

function isBlockedTocEntry<T extends LeveledChapter>(
  chapter: T | undefined,
  isTocLike?: (chapter: T) => boolean,
): chapter is T {
  return Boolean(chapter && !isTocLike?.(chapter))
}

/** 在展平 TOC 中取上一/下一可导航条目（最小目录步进） */
export function resolveAdjacentFlatNav<T extends LeveledChapter>(
  chapters: T[],
  flatIndex: number,
  options: AdjacentFlatNavOptions<T> = {},
): AdjacentFlatNavState<T> {
  if (chapters.length === 0 || flatIndex < 0 || flatIndex >= chapters.length) {
    return { ...EMPTY_ADJACENT_NAV }
  }

  const current = chapters[flatIndex]!
  if (!isBlockedTocEntry(current, options.isTocLike)) {
    return { ...EMPTY_ADJACENT_NAV, flatIndex }
  }

  let previous: T | null = null
  let previousIndex = -1
  for (let i = flatIndex - 1; i >= 0; i -= 1) {
    const chapter = chapters[i]!
    if (!isBlockedTocEntry(chapter, options.isTocLike)) continue
    if (options.shouldSkipAdjacent?.(current, chapter)) continue
    previous = chapter
    previousIndex = i
    break
  }

  let next: T | null = null
  let nextIndex = -1
  for (let i = flatIndex + 1; i < chapters.length; i += 1) {
    const chapter = chapters[i]!
    if (!isBlockedTocEntry(chapter, options.isTocLike)) continue
    if (options.shouldSkipAdjacent?.(current, chapter)) continue
    next = chapter
    nextIndex = i
    break
  }

  return {
    current,
    previous,
    next,
    currentIndex: flatIndex,
    previousIndex,
    nextIndex,
    flatIndex,
  }
}

/** 滚轮/翻页：跳过与当前 load key 相同的条目，直到下一个 spine 切片 */
export function findNextDistinctLoadTarget<T extends LeveledChapter>(
  chapters: T[],
  flatIndex: number,
  options: AdjacentFlatNavOptions<T> = {},
): { item: T; index: number } | null {
  if (flatIndex < 0 || !options.getLoadTargetKey) return null
  const currentKey = options.getLoadTargetKey(chapters[flatIndex]!)

  for (let i = flatIndex + 1; i < chapters.length; i += 1) {
    const chapter = chapters[i]!
    if (!isBlockedTocEntry(chapter, options.isTocLike)) continue
    if (options.getLoadTargetKey(chapter) === currentKey) continue
    return { item: chapter, index: i }
  }
  return null
}

export function findPreviousDistinctLoadTarget<T extends LeveledChapter>(
  chapters: T[],
  flatIndex: number,
  options: AdjacentFlatNavOptions<T> = {},
): { item: T; index: number } | null {
  if (flatIndex < 0 || !options.getLoadTargetKey) return null
  const currentKey = options.getLoadTargetKey(chapters[flatIndex]!)

  for (let i = flatIndex - 1; i >= 0; i -= 1) {
    const chapter = chapters[i]!
    if (!isBlockedTocEntry(chapter, options.isTocLike)) continue
    if (options.getLoadTargetKey(chapter) === currentKey) continue
    return { item: chapter, index: i }
  }
  return null
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
  isTocLike?: (chapter: T) => boolean,
): number {
  if (flatIndex < 0) return -1
  for (let i = flatIndex; i >= 0; i -= 1) {
    const chapter = chapters[i]!
    if (isTocLike?.(chapter)) continue
    if (chapter.level === navLevel) return i
    if (chapter.level < navLevel) return i
  }
  return -1
}

export function findPreviousNavChapterIndex<T extends LeveledChapter>(
  chapters: T[],
  anchorIndex: number,
  navLevel: number,
  options: {
    isTocLike?: (chapter: T) => boolean
    shouldSkipAdjacent?: (current: T, candidate: T) => boolean
  } = {},
): number {
  if (anchorIndex < 0) return -1
  const current = chapters[anchorIndex]!
  for (let i = anchorIndex - 1; i >= 0; i -= 1) {
    const chapter = chapters[i]!
    if (options.isTocLike?.(chapter)) continue
    if (chapter.level > navLevel) continue
    if (options.shouldSkipAdjacent?.(current, chapter)) continue
    return i
  }
  return -1
}

export function findNextNavChapterIndex<T extends LeveledChapter>(
  chapters: T[],
  anchorIndex: number,
  navLevel: number,
  options: {
    isTocLike?: (chapter: T) => boolean
    shouldSkipAdjacent?: (current: T, candidate: T) => boolean
  } = {},
): number {
  if (anchorIndex < 0) return -1
  const current = chapters[anchorIndex]!
  for (let i = anchorIndex + 1; i < chapters.length; i += 1) {
    const chapter = chapters[i]!
    if (options.isTocLike?.(chapter)) continue
    if (chapter.level > navLevel) continue
    if (options.shouldSkipAdjacent?.(current, chapter)) continue
    return i
  }
  return -1
}

export function findPreviousNavChapter<T extends LeveledChapter>(
  chapters: T[],
  anchorIndex: number,
  navLevel: number,
  options: {
    isTocLike?: (chapter: T) => boolean
    shouldSkipAdjacent?: (current: T, candidate: T) => boolean
  } = {},
): T | null {
  const index = findPreviousNavChapterIndex(chapters, anchorIndex, navLevel, options)
  return index >= 0 ? chapters[index]! : null
}

export function findNextNavChapter<T extends LeveledChapter>(
  chapters: T[],
  anchorIndex: number,
  navLevel: number,
  options: {
    isTocLike?: (chapter: T) => boolean
    shouldSkipAdjacent?: (current: T, candidate: T) => boolean
  } = {},
): T | null {
  const index = findNextNavChapterIndex(chapters, anchorIndex, navLevel, options)
  return index >= 0 ? chapters[index]! : null
}

/** 底栏上一章/下一章：与正文渲染粒度一致，跳过更细的小节 */
export function resolveReaderChapterNav<T extends LeveledChapter>(
  chapters: T[],
  flatIndex: number,
  navLevel: number,
  options: {
    isTocLike?: (chapter: T) => boolean
    shouldSkipAdjacent?: (current: T, candidate: T) => boolean
  } = {},
): AdjacentFlatNavState<T> {
  const anchorIndex = findAnchorLevelIndex(chapters, flatIndex, navLevel, options.isTocLike)
  const previousIndex = findPreviousNavChapterIndex(chapters, anchorIndex, navLevel, options)
  const nextIndex = findNextNavChapterIndex(chapters, anchorIndex, navLevel, options)
  const current = anchorIndex >= 0 ? chapters[anchorIndex]! : null

  return {
    current,
    previous: previousIndex >= 0 ? chapters[previousIndex]! : null,
    next: nextIndex >= 0 ? chapters[nextIndex]! : null,
    currentIndex: anchorIndex,
    previousIndex,
    nextIndex,
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
): AdjacentFlatNavState<T> {
  return resolveReaderChapterNav(chapters, flatIndex, 0)
}

/** MOBI/AZW3：同一 spine 章节可对应多个 TOC 项，取第一个匹配项（视口同步负责精确定位） */
export function findFirstFlatIndexById<T extends LeveledChapter & { id: string }>(
  chapters: T[],
  currentId?: string,
): number {
  if (!currentId) return -1
  return chapters.findIndex((chapter) => chapter.id === currentId)
}

/** @deprecated 同 spine 多 TOC 请优先 flatIndex / 视口同步，勿默认取最后一条 */
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
