import {
  isTocLikeChapter,
  resolveChapterNav,
  type EpubChapter,
  type EpubLocationHint,
} from '@/lib/reader/epub-navigation'
import { findEpubFlatIndexFromViewport, findMobiFlatIndexFromViewport } from '@/lib/reader/epub-scroll-toc'
import { resolveMobiChapterNav, type MobiChapterItem } from '@/lib/reader/mobi-navigation'
import {
  pickReaderNavLevel,
  resolveReaderChapterNav,
  type AdjacentFlatNavState,
} from '@/lib/reader/reader-chapter-nav'
import type { ReaderUnit } from '@/lib/reader/reader-navigation'

export type ReaderFormat = 'epub' | 'mobi' | 'pdf'

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

export function syncEpubNavigationFromViewport(
  units: EpubChapter[],
  document: Document,
  spineHref: string,
): AdjacentFlatNavState<ReaderUnit> {
  const flatIndex = findEpubFlatIndexFromViewport(units, document, spineHref)
  if (flatIndex < 0) return EMPTY_READER_NAV
  return resolveChapterNav(units, undefined, flatIndex)
}

interface EpubRenditionContents {
  document?: Document
}

interface EpubRenditionLike {
  getContents: () => unknown
  currentLocation: () => unknown
}

function resolveSpineHrefFromRenditionLocation(location: unknown): string | undefined {
  if (!location || typeof location !== 'object') return undefined

  const record = location as Record<string, unknown>
  if (typeof record.href === 'string') return record.href

  const start = record.start
  if (start && typeof start === 'object' && typeof (start as { href?: string }).href === 'string') {
    return (start as { href: string }).href
  }

  return undefined
}

/** scrolled-doc：优先用 iframe 视口锚点同步，避免 relocated 仅给 spine href 时错位 */
export function syncEpubNavigationFromRendition(
  units: EpubChapter[],
  rendition: EpubRenditionLike,
): AdjacentFlatNavState<ReaderUnit> {
  const spineHref = resolveSpineHrefFromRenditionLocation(rendition.currentLocation())
  if (!spineHref) return EMPTY_READER_NAV

  const raw = rendition.getContents()
  const contentsList = (Array.isArray(raw) ? raw : raw ? [raw] : []) as EpubRenditionContents[]

  for (const contents of contentsList) {
    if (!contents.document) continue
    const nav = syncEpubNavigationFromViewport(units, contents.document, spineHref)
    if (nav.flatIndex >= 0) return nav
  }

  return EMPTY_READER_NAV
}

export function syncMobiNavigationFromViewport(
  units: MobiChapterItem[],
  document: Document,
  chapterId: string,
): AdjacentFlatNavState<ReaderUnit> {
  const flatIndex = findMobiFlatIndexFromViewport(units, document, chapterId)
  if (flatIndex < 0) return EMPTY_READER_NAV
  return syncMobiNavigation(units, chapterId, flatIndex)
}

export function syncMobiNavigation(
  units: MobiChapterItem[],
  chapterId?: string,
  flatIndex?: number,
): AdjacentFlatNavState<ReaderUnit> {
  return resolveMobiChapterNav(units, chapterId, flatIndex) as unknown as AdjacentFlatNavState<ReaderUnit>
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
