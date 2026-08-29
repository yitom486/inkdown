import {
  resolveAdjacentFlatNav,
  type AdjacentFlatNavState,
} from '@/lib/reader-chapter-nav'

export interface EpubChapter {
  label: string
  href: string
  level: number
}

export interface EpubTocSource {
  label: string
  href: string
  subitems?: EpubTocSource[]
}

export type EpubChapterNavState = AdjacentFlatNavState<EpubChapter>

export interface EpubLocationHint {
  href?: string
  cfi?: string
  /** 全书阅读进度 0–1，用于同文件多目录项时定位当前节 */
  percentage?: number
}

const TOC_LIKE_PATTERN = /^(目录|目次|table of contents|contents|toc)$/i

export function isTocLikeChapter(chapter: EpubChapter): boolean {
  if (TOC_LIKE_PATTERN.test(chapter.label.trim())) return true
  const path = (chapter.href.split('#')[0] ?? chapter.href).toLowerCase()
  const fileName = path.split(/[/\\]/).pop() ?? path
  return /^(nav|toc|contents)([._-]|$)/i.test(fileName)
}

/** 将 EPUB 目录树展平为章节列表（用于底部导航） */
export function flattenEpubToc(items: EpubTocSource[], level = 0): EpubChapter[] {
  return items.flatMap((item) => {
    const chapter: EpubChapter = {
      label: item.label.trim() || '未命名章节',
      href: item.href,
      level,
    }
    const children = flattenEpubToc(item.subitems ?? [], level + 1)
    return [chapter, ...children]
  })
}

/** 选择首个正文章节，尽量跳过纯目录页 */
export function pickInitialChapter(chapters: EpubChapter[]): EpubChapter | null {
  if (chapters.length === 0) return null
  return chapters.find((chapter) => !isTocLikeChapter(chapter)) ?? chapters[0]!
}

function normalizeHref(href: string): string {
  return href.split('#')[0]?.toLowerCase() ?? href.toLowerCase()
}

function shouldSkipEpubParentAdjacent(current: EpubChapter, candidate: EpubChapter): boolean {
  if (!current.href.includes('#')) return false
  const currentBase = normalizeHref(current.href)
  const candidateBase = normalizeHref(candidate.href)
  if (currentBase !== candidateBase) return false
  return !candidate.href.includes('#')
}

function hrefMatches(currentHref: string, chapterHref: string): boolean {
  const current = normalizeHref(currentHref)
  const target = normalizeHref(chapterHref)
  return current === target || current.endsWith(target) || target.endsWith(current)
}

function collectSameDocumentCandidates(
  chapters: EpubChapter[],
  currentHref: string,
): number[] {
  const currentHasFragment = currentHref.includes('#')
  const currentBase = normalizeHref(currentHref)
  const candidates: number[] = []

  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i]!
    if (currentHasFragment) {
      if (chapter.href === currentHref) candidates.push(i)
      continue
    }
    const chapterBase = normalizeHref(chapter.href)
    if (chapterBase === currentBase || hrefMatches(currentHref, chapter.href)) {
      candidates.push(i)
    }
  }

  return candidates
}

function pickFirstNavigableCandidate(
  chapters: EpubChapter[],
  candidates: number[],
): number {
  const navigable = candidates.find((index) => !isTocLikeChapter(chapters[index]!))
  return navigable ?? candidates[0]!
}

function pickCandidateByPercentage(
  chapters: EpubChapter[],
  candidates: number[],
  percentage: number,
): number {
  const navigableIndices = chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter }) => !isTocLikeChapter(chapter))
    .map(({ index }) => index)

  if (navigableIndices.length === 0) {
    return pickFirstNavigableCandidate(chapters, candidates)
  }

  const clamped = Math.min(1, Math.max(0, percentage))
  const firstNav = navigableIndices[0]!
  const lastNav = navigableIndices[navigableIndices.length - 1]!
  const targetIndex = firstNav + clamped * (lastNav - firstNav)

  let best = candidates[0]!
  let bestDistance = Number.POSITIVE_INFINITY
  for (const index of candidates) {
    if (isTocLikeChapter(chapters[index]!)) continue
    const distance = Math.abs(index - targetIndex)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }

  return best
}

function preferLeafCandidates(
  chapters: EpubChapter[],
  candidates: number[],
  currentHref: string,
): number[] {
  if (currentHref.includes('#')) return candidates
  const withFragment = candidates.filter((index) => chapters[index]!.href.includes('#'))
  return withFragment.length > 0 ? withFragment : candidates
}

/** 根据 href / 阅读进度定位展平 TOC 中的当前节（同 HTML 多目录项时不取「最后一条」） */
export function findEpubFlatIndex(
  chapters: EpubChapter[],
  hint: EpubLocationHint,
): number {
  const href = hint.href?.trim()
  if (!href) return -1

  if (href.includes('#')) {
    const exactIndex = chapters.findIndex((chapter) => chapter.href === href)
    if (exactIndex >= 0) return exactIndex
  }

  let candidates = collectSameDocumentCandidates(chapters, href)
  if (candidates.length === 0) return -1
  if (candidates.length === 1) return candidates[0]!

  candidates = preferLeafCandidates(chapters, candidates, href)

  if (typeof hint.percentage === 'number' && Number.isFinite(hint.percentage)) {
    return pickCandidateByPercentage(chapters, candidates, hint.percentage)
  }

  return pickFirstNavigableCandidate(chapters, candidates)
}

/** @deprecated 请使用 findEpubFlatIndex */
export function findLastEpubFlatIndex(chapters: EpubChapter[], currentHref?: string): number {
  return findEpubFlatIndex(chapters, { href: currentHref })
}

function resolveFlatIndex(
  chapters: EpubChapter[],
  hint?: EpubLocationHint,
  flatIndex?: number,
): number {
  if (typeof flatIndex === 'number' && flatIndex >= 0 && flatIndex < chapters.length) {
    return flatIndex
  }
  if (hint?.href) {
    return findEpubFlatIndex(chapters, hint)
  }
  const initial = pickInitialChapter(chapters)
  if (!initial) return -1
  return chapters.findIndex(
    (item) => item.href === initial.href && item.label === initial.label,
  )
}

/** 根据当前 location 在展平 TOC 中解析上一节 / 当前 / 下一节 */
export function resolveChapterNav(
  chapters: EpubChapter[],
  hintOrHref?: EpubLocationHint | string,
  flatIndex?: number,
): EpubChapterNavState {
  if (chapters.length === 0) {
    return {
      current: null,
      previous: null,
      next: null,
      currentIndex: -1,
      previousIndex: -1,
      nextIndex: -1,
      flatIndex: -1,
    }
  }

  const hint =
    typeof hintOrHref === 'string' ? { href: hintOrHref } : (hintOrHref ?? undefined)
  const resolvedFlatIndex = resolveFlatIndex(chapters, hint, flatIndex)
  if (resolvedFlatIndex < 0) {
    return {
      current: null,
      previous: null,
      next: null,
      currentIndex: -1,
      previousIndex: -1,
      nextIndex: -1,
      flatIndex: -1,
    }
  }

  return resolveAdjacentFlatNav(chapters, resolvedFlatIndex, {
    isTocLike: isTocLikeChapter,
    getLoadTargetKey: (chapter) => chapter.href,
    shouldSkipAdjacent: shouldSkipEpubParentAdjacent,
  })
}
