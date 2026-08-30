import type { EpubChapter } from '@/lib/reader/epub-navigation'
import type { MobiChapterItem } from '@/lib/reader/mobi-navigation'
import {
  findFlatIndexFromViewport,
  findFragmentElement,
  normalizeLoadKey,
  scrollToViewportEntry,
  type ViewportNavEntry,
} from '@/lib/reader/reader-viewport-nav'
import { isTocLikeChapter } from '@/lib/reader/epub-navigation'
import { isTocLikeMobiChapter } from '@/lib/reader/mobi-navigation'

/** 章内跳转后在标题上方保留呼吸空间，避免标题贴住阅读区顶边。 */
export const MOBI_ANCHOR_TOP_OFFSET = 64

function hrefMatches(currentHref: string, chapterHref: string): boolean {
  const current = normalizeLoadKey(currentHref)
  const target = normalizeLoadKey(chapterHref)
  return current === target || current.endsWith(target) || target.endsWith(current)
}

export function buildEpubViewportEntries(
  chapters: EpubChapter[],
  spineHref: string,
): ViewportNavEntry[] {
  const base = normalizeLoadKey(spineHref)
  const raw = chapters
    .map((chapter, flatIndex) => ({ chapter, flatIndex }))
    .filter(({ chapter }) => {
      if (isTocLikeChapter(chapter)) return false
      const chapterBase = normalizeLoadKey(chapter.href)
      return chapterBase === base || hrefMatches(spineHref, chapter.href)
    })
    .map(({ chapter, flatIndex }) => ({
      flatIndex,
      label: chapter.label,
      loadKey: base,
      fragment: chapter.href.includes('#') ? chapter.href.split('#')[1] : undefined,
    }))

  return raw
}

export function buildMobiViewportEntries(
  chapters: MobiChapterItem[],
  chapterId: string,
): ViewportNavEntry[] {
  return chapters
    .map((chapter, flatIndex) => ({ chapter, flatIndex }))
    .filter(({ chapter }) => chapter.id === chapterId && !isTocLikeMobiChapter(chapter))
    .map(({ chapter, flatIndex }) => ({
      flatIndex,
      label: chapter.label,
      loadKey: chapter.id,
      selector: chapter.selector,
    }))
}

export function findEpubFlatIndexFromViewport(
  chapters: EpubChapter[],
  document: Document,
  spineHref?: string,
): number {
  if (!spineHref) return -1
  const entries = buildEpubViewportEntries(chapters, spineHref)
  return findFlatIndexFromViewport(document, entries, spineHref)
}

export function findMobiFlatIndexFromViewport(
  chapters: MobiChapterItem[],
  document: Document,
  chapterId: string,
): number {
  const entries = buildMobiViewportEntries(chapters, chapterId)
  return findFlatIndexFromViewport(document, entries, chapterId)
}

export function scrollEpubChapterToFragment(
  document: Document,
  chapter: EpubChapter,
  options?: { behavior?: ScrollBehavior },
): boolean {
  const fragment = chapter.href.split('#')[1]
  if (!fragment) return false
  return scrollToViewportEntry(
    document,
    {
      flatIndex: -1,
      label: chapter.label,
      loadKey: normalizeLoadKey(chapter.href),
      fragment,
    },
    options,
  )
}

export function scrollMobiChapterToFlatIndex(
  document: Document,
  chapters: MobiChapterItem[],
  flatIndex: number,
  options?: { behavior?: ScrollBehavior; topOffset?: number },
): boolean {
  const chapter = chapters[flatIndex]
  if (!chapter) return false
  return scrollToViewportEntry(
    document,
    {
      flatIndex,
      label: chapter.label,
      loadKey: chapter.id,
      selector: chapter.selector,
    },
    {
      ...options,
      topOffset: options?.topOffset ?? MOBI_ANCHOR_TOP_OFFSET,
    },
  )
}

interface EpubRenditionContents {
  document?: Document
}

interface EpubRenditionLike {
  getContents: () => unknown
  currentLocation: () => unknown
}

function resolveSpineHrefFromRendition(rendition: EpubRenditionLike): string | undefined {
  const location = rendition.currentLocation()
  if (!location || typeof location !== 'object') return undefined
  const record = location as Record<string, unknown>
  if (typeof record.href === 'string') return record.href
  const start = record.start
  if (start && typeof start === 'object' && typeof (start as { href?: string }).href === 'string') {
    return (start as { href: string }).href
  }
  return undefined
}

function getRenditionContents(rendition: EpubRenditionLike): EpubRenditionContents[] {
  const raw = rendition.getContents()
  return (Array.isArray(raw) ? raw : raw ? [raw] : []) as EpubRenditionContents[]
}

export function scrollEpubChapterToEntry(
  document: Document,
  chapter: EpubChapter,
  options?: { behavior?: ScrollBehavior },
): boolean {
  if (chapter.href.includes('#')) {
    return scrollEpubChapterToFragment(document, chapter, options)
  }
  return scrollToViewportEntry(
    document,
    {
      flatIndex: -1,
      label: chapter.label,
      loadKey: normalizeLoadKey(chapter.href),
    },
    options,
  )
}

export function scrollEpubChapterInRendition(
  rendition: EpubRenditionLike,
  chapter: EpubChapter,
): boolean {
  const targetBase = normalizeLoadKey(chapter.href)
  const currentBase = normalizeLoadKey(resolveSpineHrefFromRendition(rendition) ?? '')
  if (!targetBase || targetBase !== currentBase) return false

  for (const contents of getRenditionContents(rendition)) {
    if (!contents.document) continue
    if (scrollEpubChapterToEntry(contents.document, chapter, { behavior: 'auto' })) return true
  }

  return false
}

export { normalizeLoadKey as normalizeSpineHref, findFragmentElement } from '@/lib/reader/reader-viewport-nav'
