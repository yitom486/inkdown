/**
 * EPUB flatIndex 跳转：同 spine 只滚动，跨 spine 才 display。
 * 侧栏点小节 / 章内锚点走此路径；底栏上一章/下一章用 nav.nextIndex（渲染级）。
 */

import type { EpubChapter } from '@/lib/epub-navigation'
import { scrollEpubChapterInRendition } from '@/lib/epub-scroll-toc'
import { normalizeLoadKey } from '@/lib/reader-viewport-nav'

export function epubLoadKey(chapter: EpubChapter): string {
  return normalizeLoadKey(chapter.href)
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

/** 先 syncFlatIndex，同 spine 只滚动，跨 spine 才 display */
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
