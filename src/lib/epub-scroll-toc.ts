import {
  type EpubChapter,
  isTocLikeChapter,
} from '@/lib/epub-navigation'

export function normalizeSpineHref(href: string): string {
  return href.split('#')[0]?.toLowerCase() ?? href.toLowerCase()
}

function hrefMatches(currentHref: string, chapterHref: string): boolean {
  const current = normalizeSpineHref(currentHref)
  const target = normalizeSpineHref(chapterHref)
  return current === target || current.endsWith(target) || target.endsWith(current)
}

function decodeFragment(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function findFragmentElement(document: Document, fragment: string): HTMLElement | null {
  const decoded = decodeFragment(fragment)
  const candidates = [fragment, decoded]
  for (const id of candidates) {
    const byId = document.getElementById(id)
    if (byId) return byId
    const byQuery = document.querySelector(`#${CSS.escape(id)}`)
    if (byQuery instanceof HTMLElement) return byQuery
    const byName = document.querySelector(`a[name="${id}"]`)
    if (byName instanceof HTMLElement) return byName
  }
  return null
}

function collectSameDocumentChapters(
  chapters: EpubChapter[],
  spineHref: string,
): Array<{ chapter: EpubChapter; index: number }> {
  const base = normalizeSpineHref(spineHref)
  return chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter }) => {
      if (isTocLikeChapter(chapter)) return false
      const chapterBase = normalizeSpineHref(chapter.href)
      return chapterBase === base || hrefMatches(spineHref, chapter.href)
    })
}

function resolveScrollRoot(document: Document): HTMLElement {
  return (document.scrollingElement ?? document.documentElement) as HTMLElement
}

function measureHeadingTop(element: HTMLElement, scrollRoot: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  const rootRect = scrollRoot.getBoundingClientRect()
  return rect.top - rootRect.top + scrollRoot.scrollTop
}

/**
 * scrolled-doc：根据视口内可见锚点定位当前 TOC 节。
 * 1. 标准 scroll-spy：标题顶越过视口上方激活线
 * 2. 过渡提升：下一节标题已在视口内露出（如截图中底部已见「研究策略」）则切到该节
 */
export function findEpubFlatIndexFromViewport(
  chapters: EpubChapter[],
  document: Document,
  spineHref?: string,
): number {
  if (!spineHref) return -1

  const sameDoc = collectSameDocumentChapters(chapters, spineHref)
  if (sameDoc.length === 0) return -1

  const withFragment = sameDoc.filter(({ chapter }) => chapter.href.includes('#'))
  if (withFragment.length === 0) return sameDoc[0]!.index

  const scrollRoot = resolveScrollRoot(document)
  const viewportHeight = scrollRoot.clientHeight || document.documentElement.clientHeight
  const activationLine = Math.min(160, viewportHeight * 0.2)
  const scrollTop = scrollRoot.scrollTop

  let activeIndex = withFragment[0]!.index

  for (const { chapter, index } of withFragment) {
    const fragment = chapter.href.split('#')[1]
    if (!fragment) continue
    const element = findFragmentElement(document, fragment)
    if (!element) continue

    if (element.offsetTop <= scrollTop + activationLine) {
      activeIndex = index
    }
  }

  const viewportBottom = scrollTop + viewportHeight

  for (let i = withFragment.length - 1; i >= 0; i -= 1) {
    const { chapter, index } = withFragment[i]!
    if (index <= activeIndex) break

    const fragment = chapter.href.split('#')[1]
    if (!fragment) continue
    const element = findFragmentElement(document, fragment)
    if (!element) continue

    const top = element.offsetTop
    const bottom = top + element.offsetHeight
    const headingPeekVisible =
      top < viewportBottom - 24 && bottom > scrollTop + activationLine * 0.75

    if (headingPeekVisible) {
      activeIndex = index
      break
    }
  }

  return activeIndex
}

export function scrollEpubChapterToFragment(
  document: Document,
  chapter: EpubChapter,
  options?: { behavior?: ScrollBehavior },
): boolean {
  const fragment = chapter.href.split('#')[1]
  if (!fragment) return false

  const element = findFragmentElement(document, fragment)
  if (!element) return false

  const behavior = options?.behavior ?? 'smooth'
  const scrollRoot = resolveScrollRoot(document)
  const top = measureHeadingTop(element, scrollRoot)

  element.scrollIntoView({ behavior, block: 'start' })
  scrollRoot.scrollTo({ top, behavior })
  return true
}

interface EpubRenditionContents {
  document?: Document
  window?: Window
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

/** 同 spine 文件内：滚动到 fragment，避免 display 同文件时「下一节」无反应 */
export function scrollEpubChapterInRendition(
  rendition: EpubRenditionLike,
  chapter: EpubChapter,
): boolean {
  const targetBase = normalizeSpineHref(chapter.href)
  const currentBase = normalizeSpineHref(resolveSpineHrefFromRendition(rendition) ?? '')
  if (!chapter.href.includes('#') || !targetBase || targetBase !== currentBase) return false

  for (const contents of getRenditionContents(rendition)) {
    if (!contents.document) continue
    if (scrollEpubChapterToFragment(contents.document, chapter)) return true
  }

  return false
}
