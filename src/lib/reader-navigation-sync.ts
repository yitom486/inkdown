import {
  resolveChapterNav,
  type EpubChapter,
  type EpubLocationHint,
} from '@/lib/epub-navigation'
import { findEpubFlatIndexFromViewport, findMobiFlatIndexFromViewport } from '@/lib/epub-scroll-toc'
import { resolveMobiChapterNav, type MobiChapterItem } from '@/lib/mobi-navigation'
import type { AdjacentFlatNavState } from '@/lib/reader-chapter-nav'
import type { ReaderUnit } from '@/lib/reader-navigation'

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

export function syncPdfNavigation(
  units: ReaderUnit[],
  pageNum?: number,
  flatIndex?: number,
): AdjacentFlatNavState<ReaderUnit> {
  if (typeof flatIndex === 'number' && flatIndex >= 0 && flatIndex < units.length) {
    return resolveChapterNav(units, undefined, flatIndex)
  }
  if (typeof pageNum === 'number' && Number.isFinite(pageNum)) {
    return resolveChapterNav(units, String(pageNum))
  }
  return EMPTY_READER_NAV
}
