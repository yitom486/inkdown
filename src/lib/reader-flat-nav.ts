/**
 * 阅读器 flatIndex 导航（跨格式）
 *
 * 渲染粒度 loadKey：EPUB spine 文件 / MOBI chapter.id —— 一次灌入连续 HTML
 * 导航粒度 flatIndex：展平 TOC 每一条 —— 底部上一节/当前/下一节
 *
 * 同 loadKey 内点「下一节」= 只滚到下一 TOC 锚点，不得 reload / display 短路。
 */

import type { EpubChapter } from '@/lib/epub-navigation'
import { scrollEpubChapterInRendition } from '@/lib/epub-scroll-toc'
import type { MobiChapterItem } from '@/lib/mobi-navigation'
import { normalizeLoadKey } from '@/lib/reader-viewport-nav'

export function epubLoadKey(chapter: EpubChapter): string {
  return normalizeLoadKey(chapter.href)
}

export function mobiLoadKey(chapter: MobiChapterItem): string {
  return chapter.id
}

export function isSameEpubLoadKey(a: EpubChapter, b: EpubChapter): boolean {
  return epubLoadKey(a) === epubLoadKey(b)
}

interface EpubRenditionLike {
  getContents: () => unknown
  currentLocation: () => unknown
  display: (target: string) => Promise<unknown>
}

function resolveCurrentEpubLoadKey(rendition: EpubRenditionLike): string {
  const location = rendition.currentLocation()
  if (!location || typeof location !== 'object') return ''
  const record = location as Record<string, unknown>
  const href =
    typeof record.href === 'string'
      ? record.href
      : typeof (record.start as { href?: string } | undefined)?.href === 'string'
        ? (record.start as { href: string }).href
        : ''
  return normalizeLoadKey(href)
}

/** EPUB：先 syncFlatIndex，同 spine 只滚动，跨 spine 才 display */
export function navigateEpubToFlatIndex(
  chapters: EpubChapter[],
  flatIndex: number,
  rendition: EpubRenditionLike,
  syncFlatIndex: (index: number) => void,
): EpubChapter | null {
  const chapter = chapters[flatIndex]
  if (!chapter) return null

  syncFlatIndex(flatIndex)

  const currentLoadKey = resolveCurrentEpubLoadKey(rendition)
  const targetLoadKey = epubLoadKey(chapter)

  if (currentLoadKey && targetLoadKey === currentLoadKey) {
    if (!scrollEpubChapterInRendition(rendition, chapter)) {
      void rendition.display(chapter.href)
    }
    return chapter
  }

  void rendition.display(chapter.href)
  return chapter
}

export interface MobiNavigateToFlatIndexOptions {
  chapters: MobiChapterItem[]
  flatIndex: number
  currentChapterId: string | undefined
  getDocument: () => Document | null | undefined
  syncFlatIndex: (index: number) => void
  scrollToFlatIndex: (document: Document, flatIndex: number) => boolean
  loadChapterById: (chapterId: string) => Promise<boolean>
}

/** MOBI/AZW3：先 syncFlatIndex，同 chapter.id 只滚动，跨 id 才 reload iframe */
export async function navigateMobiToFlatIndex(
  options: MobiNavigateToFlatIndexOptions,
): Promise<boolean> {
  const {
    chapters,
    flatIndex,
    currentChapterId,
    getDocument,
    syncFlatIndex,
    scrollToFlatIndex,
    loadChapterById,
  } = options
  const chapter = chapters[flatIndex]
  if (!chapter) return false

  syncFlatIndex(flatIndex)

  if (chapter.id === currentChapterId) {
    const doc = getDocument()
    if (doc) scrollToFlatIndex(doc, flatIndex)
    return true
  }

  const loaded = await loadChapterById(chapter.id)
  if (!loaded) return false

  const doc = getDocument()
  if (doc) scrollToFlatIndex(doc, flatIndex)
  return true
}
