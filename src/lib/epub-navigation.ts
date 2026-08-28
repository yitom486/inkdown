import { resolveTopLevelChapterNav } from '@/lib/reader-chapter-nav'

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

export interface EpubChapterNavState {
  current: EpubChapter | null
  previous: EpubChapter | null
  next: EpubChapter | null
  currentIndex: number
}

const TOC_LIKE_PATTERN = /^(目录|目次|table of contents|contents|toc)$/i

export function isTocLikeChapter(chapter: EpubChapter): boolean {
  if (TOC_LIKE_PATTERN.test(chapter.label.trim())) return true
  const href = chapter.href.toLowerCase()
  return href.includes('nav') || href.includes('toc')
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

function hrefMatches(currentHref: string, chapterHref: string): boolean {
  const current = normalizeHref(currentHref)
  const target = normalizeHref(chapterHref)
  return current === target || current.endsWith(target) || target.endsWith(current)
}

/** 优先精确匹配（含 hash），否则取最长前缀匹配 */
function findChapterFlatIndex(chapters: EpubChapter[], currentHref?: string): number {
  if (!currentHref) return -1

  const exactIndex = chapters.findIndex((chapter) => chapter.href === currentHref)
  if (exactIndex >= 0) return exactIndex

  let bestIndex = -1
  let bestLength = -1
  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i]!
    if (!hrefMatches(currentHref, chapter.href)) continue
    if (chapter.href.length > bestLength) {
      bestIndex = i
      bestLength = chapter.href.length
    }
  }
  return bestIndex
}

/** 根据当前 location.href 解析上一章 / 当前 / 下一章（仅一级标题间切换） */
export function resolveChapterNav(
  chapters: EpubChapter[],
  currentHref?: string,
): EpubChapterNavState {
  if (chapters.length === 0) {
    return { current: null, previous: null, next: null, currentIndex: -1 }
  }

  if (!currentHref) {
    const initial = pickInitialChapter(chapters)
    const flatIndex = initial ? chapters.findIndex((item) => item.href === initial.href) : 0
    return resolveTopLevelChapterNav(chapters, flatIndex)
  }

  const flatIndex = findChapterFlatIndex(chapters, currentHref)
  if (flatIndex < 0) {
    return {
      current: null,
      previous: null,
      next: null,
      currentIndex: -1,
    }
  }

  return resolveTopLevelChapterNav(chapters, flatIndex)
}
