import {
  type EpubChapter,
  isTocLikeChapter,
} from '@/lib/epub-navigation'

function normalizeHref(href: string): string {
  return href.split('#')[0]?.toLowerCase() ?? href.toLowerCase()
}

function hrefMatches(currentHref: string, chapterHref: string): boolean {
  const current = normalizeHref(currentHref)
  const target = normalizeHref(chapterHref)
  return current === target || current.endsWith(target) || target.endsWith(current)
}

function decodeFragment(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function findFragmentElement(document: Document, fragment: string): HTMLElement | null {
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
  const base = normalizeHref(spineHref)
  return chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter }) => {
      if (isTocLikeChapter(chapter)) return false
      const chapterBase = normalizeHref(chapter.href)
      return chapterBase === base || hrefMatches(spineHref, chapter.href)
    })
}

/** scrolled-doc：根据视口内可见锚点定位当前 TOC 节（比全书百分比更准确） */
export function findEpubFlatIndexFromViewport(
  chapters: EpubChapter[],
  document: Document,
  spineHref?: string,
): number {
  if (!spineHref) return -1

  const sameDoc = collectSameDocumentChapters(chapters, spineHref)
  if (sameDoc.length === 0) return -1

  const withFragment = sameDoc.filter(({ chapter }) => chapter.href.includes('#'))
  const scrollRoot = document.scrollingElement ?? document.documentElement
  const viewportAnchor = scrollRoot.scrollTop + scrollRoot.clientHeight * 0.22

  if (withFragment.length > 0) {
    let bestIndex = withFragment[0]!.index
    let bestTop = -1

    for (const { chapter, index } of withFragment) {
      const fragment = chapter.href.split('#')[1]
      if (!fragment) continue
      const element = findFragmentElement(document, fragment)
      if (!element) continue

      const top = element.offsetTop
      if (top <= viewportAnchor + 8 && top >= bestTop) {
        bestTop = top
        bestIndex = index
      }
    }

    if (bestTop >= 0) return bestIndex
    return withFragment[0]!.index
  }

  return sameDoc[0]!.index
}
