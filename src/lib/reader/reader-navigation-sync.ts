import {
  isTocLikeChapter,
  resolveChapterNav,
  type EpubChapter,
  type EpubLocationHint,
} from '@/lib/reader/epub-navigation'
import {
  pickReaderNavLevel,
  resolveReaderChapterNav,
  type AdjacentFlatNavState,
} from '@/lib/reader/reader-chapter-nav'
import type { ReaderUnit } from '@/lib/reader/reader-navigation'
import { findWebDocFlatIndex, syncWebNavigation } from '@/lib/reader/web-doc-toc'

export type ReaderFormat = 'epub' | 'mobi' | 'pdf' | 'web'

export const EMPTY_READER_NAV: AdjacentFlatNavState<ReaderUnit> = {
  current: null,
  previous: null,
  next: null,
  currentIndex: -1,
  previousIndex: -1,
  nextIndex: -1,
  flatIndex: -1,
}

export function syncEpubNavigation(
  units: EpubChapter[],
  hint?: EpubLocationHint,
  flatIndex?: number,
): AdjacentFlatNavState<ReaderUnit> {
  return resolveChapterNav(units, hint, flatIndex)
}

/** PDF 大纲 href 为页码：精确匹配，否则取 page ≤ 目标页的最后一项（同页取更深层级）。 */
function findPdfFlatIndexByPage(units: ReaderUnit[], pageNum: number): number {
  if (!Number.isFinite(pageNum) || pageNum < 1) return -1

  const exact = units.findIndex((unit) => unit.href === String(pageNum))
  if (exact >= 0) return exact

  let bestIndex = -1
  let bestPage = -1
  let bestLevel = -1
  for (let index = 0; index < units.length; index += 1) {
    const page = Number.parseInt(units[index]!.href, 10)
    if (!Number.isFinite(page) || page > pageNum) continue
    const level = units[index]!.level ?? 0
    if (page > bestPage || (page === bestPage && level >= bestLevel)) {
      bestIndex = index
      bestPage = page
      bestLevel = level
    }
  }
  return bestIndex
}

/**
 * PDF 底栏按大纲 level 步进（章），不能走 EPUB 的 render-unit（每页 href 唯一，会误步进到子节页）。
 * flatIndex 仍可为小节，resolveReaderChapterNav 会回溯到章级。
 */
export function syncPdfNavigation(
  units: ReaderUnit[],
  pageNum?: number,
  flatIndex?: number,
): AdjacentFlatNavState<ReaderUnit> {
  let resolvedFlatIndex = -1
  if (typeof flatIndex === 'number' && flatIndex >= 0 && flatIndex < units.length) {
    resolvedFlatIndex = flatIndex
  } else if (typeof pageNum === 'number' && Number.isFinite(pageNum)) {
    resolvedFlatIndex = findPdfFlatIndexByPage(units, pageNum)
  }
  if (resolvedFlatIndex < 0) return EMPTY_READER_NAV

  const navLevel = pickReaderNavLevel(units, isTocLikeChapter)
  return resolveReaderChapterNav(units, resolvedFlatIndex, navLevel, {
    isTocLike: isTocLikeChapter,
  })
}

export function syncWebDocNavigation(
  units: ReaderUnit[],
  pageUrl: string,
  flatIndex?: number,
): AdjacentFlatNavState<ReaderUnit> {
  return syncWebNavigation(units, pageUrl, flatIndex)
}
