import {
  extractMobiChapterLabel,
  isMobiChapterReadable,
} from '@/lib/reader/mobi-chapter-html'
import {
  findFirstFlatIndexById,
  findNextDistinctLoadTarget,
  findPreviousDistinctLoadTarget,
  type AdjacentFlatNavState,
} from '@/lib/reader/reader-chapter-nav'

export interface MobiChapterItem {
  id: string
  label: string
  level: number
  /** KF8/AZW3：resolveHref 返回的章内锚点选择器 */
  selector?: string
}

export interface MobiTocTarget {
  id: string
  selector?: string
}

export interface MobiTocItemLike {
  label: string
  href: string
  children?: MobiTocItemLike[]
}

const TOC_LIKE_PATTERN = /^(目录|目次|table of contents|contents|toc)$/i

export const MOBI_TOC_HREF_PREFIX = 'mobi-toc:'

export function encodeMobiTocHref(flatIndex: number): string {
  return `${MOBI_TOC_HREF_PREFIX}${flatIndex}`
}

export function decodeMobiTocHref(href: string): number | null {
  if (!href.startsWith(MOBI_TOC_HREF_PREFIX)) return null
  const index = Number.parseInt(href.slice(MOBI_TOC_HREF_PREFIX.length), 10)
  return Number.isFinite(index) && index >= 0 ? index : null
}

export function isTocLikeMobiChapter(chapter: MobiChapterItem): boolean {
  return TOC_LIKE_PATTERN.test(chapter.label.trim())
}

export function flattenMobiToc(
  toc: MobiTocItemLike[],
  resolveTarget: (href: string) => MobiTocTarget | undefined,
  level = 0,
): MobiChapterItem[] {
  const result: MobiChapterItem[] = []

  const walk = (items: MobiTocItemLike[], depth: number) => {
    for (const item of items) {
      const target = resolveTarget(item.href)
      if (target?.id) {
        result.push({
          id: target.id,
          label: item.label.trim() || '未命名章节',
          level: depth,
          selector: target.selector?.trim() || undefined,
        })
      }
      if (item.children?.length) {
        walk(item.children, depth + 1)
      }
    }
  }

  walk(toc, level)
  return result
}

export function spineToChapterItems(
  spine: Array<{ id: string }>,
): MobiChapterItem[] {
  return spine.map((chapter, index) => ({
    id: chapter.id,
    label: `章节 ${index + 1}`,
    level: 0,
  }))
}

/** 过滤 MOBI spine 中的空白/脏切片，并尽量提取标题 */
export function buildReadableSpineChapters(
  spine: Array<{ id: string }>,
  loadHtml: (id: string) => string | undefined,
): MobiChapterItem[] {
  const items: MobiChapterItem[] = []
  let readableIndex = 0

  for (const entry of spine) {
    const html = loadHtml(entry.id)
    if (!html || !isMobiChapterReadable(html)) continue

    readableIndex += 1
    items.push({
      id: entry.id,
      label: extractMobiChapterLabel(html) ?? `章节 ${readableIndex}`,
      level: 0,
    })
  }

  return items
}

/** 优先 TOC，其次可读 spine，最后保留完整 spine 供兜底加载 */
export function buildMobiChapterList(
  spine: Array<{ id: string }>,
  toc: MobiTocItemLike[],
  loadHtml: (id: string) => string | undefined,
  resolveTarget: (href: string) => MobiTocTarget | undefined,
): MobiChapterItem[] {
  const readableToc = flattenMobiToc(toc, resolveTarget).filter((item) => {
    const html = loadHtml(item.id)
    return Boolean(html && isMobiChapterReadable(html))
  })
  if (readableToc.length > 0) return readableToc

  const readableSpine = buildReadableSpineChapters(spine, loadHtml)
  if (readableSpine.length > 0) return readableSpine

  return spineToChapterItems(spine)
}

export function pickReadableMobiChapterCandidates(
  chapters: MobiChapterItem[],
  preferredChapterId?: string,
): MobiChapterItem[] {
  const preferred =
    (preferredChapterId &&
      chapters.find((chapter) => chapter.id === preferredChapterId)) ||
    pickInitialMobiChapter(chapters)
  const ordered: MobiChapterItem[] = []

  if (preferred) ordered.push(preferred)
  for (const chapter of chapters) {
    if (chapter.id !== preferred?.id) ordered.push(chapter)
  }

  return ordered
}

/** 跳过纯目录页；Viewer 内还会过滤 XML 脏章节 */
export function pickInitialMobiChapter(chapters: MobiChapterItem[]): MobiChapterItem | null {
  if (chapters.length === 0) return null
  return chapters.find((chapter) => !isTocLikeMobiChapter(chapter)) ?? chapters[0]!
}

function resolveMobiFlatIndex(
  chapters: MobiChapterItem[],
  currentId?: string,
  flatIndex?: number,
): number {
  if (typeof flatIndex === 'number' && flatIndex >= 0 && flatIndex < chapters.length) {
    return flatIndex
  }
  if (currentId) {
    return findFirstFlatIndexById(chapters, currentId)
  }
  const initial = pickInitialMobiChapter(chapters)
  if (!initial) return -1
  return chapters.findIndex(
    (item) => item.id === initial.id && item.label === initial.label,
  )
}

export function resolveMobiChapterNav(
  chapters: MobiChapterItem[],
  currentId?: string,
  flatIndex?: number,
): AdjacentFlatNavState<MobiChapterItem> {
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

  const resolvedFlatIndex = resolveMobiFlatIndex(chapters, currentId, flatIndex)
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

  const spineId = chapters[resolvedFlatIndex]!.id
  const anchorIndex = findFirstFlatIndexById(chapters, spineId)
  const loadOptions = {
    isTocLike: isTocLikeMobiChapter,
    getLoadTargetKey: (chapter: MobiChapterItem) => chapter.id,
  }
  const previous = findPreviousDistinctLoadTarget(chapters, anchorIndex, loadOptions)
  const next = findNextDistinctLoadTarget(chapters, anchorIndex, loadOptions)
  const previousIndex =
    previous !== null ? findFirstFlatIndexById(chapters, previous.item.id) : -1
  const nextIndex = next !== null ? findFirstFlatIndexById(chapters, next.item.id) : -1

  return {
    current: anchorIndex >= 0 ? chapters[anchorIndex]! : null,
    previous: previousIndex >= 0 ? chapters[previousIndex]! : null,
    next: nextIndex >= 0 ? chapters[nextIndex]! : null,
    currentIndex: anchorIndex,
    previousIndex,
    nextIndex,
    flatIndex: resolvedFlatIndex,
  }
}
