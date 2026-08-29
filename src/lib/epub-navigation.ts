import { pickReaderNavLevel, resolveReaderChapterNav } from '@/lib/reader-chapter-nav'

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
  // 只检查路径文件名，忽略 #toc_id_1 等 fragment，避免把正文章节误判为目录页
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

  const navLevel = pickReaderNavLevel(chapters, isTocLikeChapter)
  const atNavLevel = chapters.find(
    (chapter) => chapter.level === navLevel && !isTocLikeChapter(chapter),
  )
  if (atNavLevel) return atNavLevel

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

/** 优先精确匹配（含 hash）；无 hash 时在同文件多条目中取最后一个（与 MOBI 一致） */
export function findLastEpubFlatIndex(chapters: EpubChapter[], currentHref?: string): number {
  if (!currentHref) return -1

  const currentHasFragment = currentHref.includes('#')
  const currentBase = normalizeHref(currentHref)
  let lastIndex = -1

  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i]!
    const chapterHref = chapter.href

    if (currentHasFragment) {
      if (chapterHref === currentHref) lastIndex = i
      continue
    }

    const chapterBase = normalizeHref(chapterHref)
    if (chapterBase === currentBase || hrefMatches(currentHref, chapterHref)) {
      lastIndex = i
    }
  }

  return lastIndex
}

/** 根据当前 location.href 解析上一章 / 当前 / 下一章 */
export function resolveChapterNav(
  chapters: EpubChapter[],
  currentHref?: string,
): EpubChapterNavState {
  if (chapters.length === 0) {
    return { current: null, previous: null, next: null, currentIndex: -1 }
  }

  const navLevel = pickReaderNavLevel(chapters, isTocLikeChapter)

  if (!currentHref) {
    const initial = pickInitialChapter(chapters)
    const flatIndex = initial
      ? chapters.findIndex((item) => item.href === initial.href && item.label === initial.label)
      : 0
    const nav = resolveReaderChapterNav(
      chapters,
      flatIndex >= 0 ? flatIndex : 0,
      navLevel,
      isTocLikeChapter,
    )
    return {
      current: nav.current,
      previous: nav.previous,
      next: nav.next,
      currentIndex: nav.currentIndex,
    }
  }

  const flatIndex = findLastEpubFlatIndex(chapters, currentHref)
  if (flatIndex < 0) {
    return {
      current: null,
      previous: null,
      next: null,
      currentIndex: -1,
    }
  }

  const nav = resolveReaderChapterNav(chapters, flatIndex, navLevel, isTocLikeChapter)
  return {
    current: nav.current,
    previous: nav.previous,
    next: nav.next,
    currentIndex: nav.currentIndex,
  }
}
