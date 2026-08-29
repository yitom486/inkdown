// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { flattenEpubToc } from '@/lib/epub-navigation'
import { navigateEpubToFlatIndex, navigateMobiToFlatIndex } from '@/lib/reader-flat-nav'
import type { MobiChapterItem } from '@/lib/mobi-navigation'

const scrollEpubChapterInRendition = vi.fn()

vi.mock('@/lib/epub-scroll-toc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/epub-scroll-toc')>()
  return {
    ...actual,
    scrollEpubChapterInRendition: (...args: unknown[]) => scrollEpubChapterInRendition(...args),
  }
})

describe('reader-flat-nav（渲染 loadKey vs 导航 flatIndex）', () => {
  it('EPUB 同 spine：点下一 flatIndex 只滚动不 display', () => {
    scrollEpubChapterInRendition.mockReturnValue(true)

    const chapters = flattenEpubToc([
      { label: '第一章 佟家的奴才', href: 'ch1.html' },
      { label: '战场上的俘虏', href: 'ch1.html#prisoners' },
    ])

    const syncFlatIndex = vi.fn()
    const display = vi.fn().mockResolvedValue(undefined)
    const rendition = {
      getContents: () => [{ document: window.document }],
      currentLocation: () => ({ start: { href: 'ch1.html' } }),
      display,
    }

    navigateEpubToFlatIndex(chapters, 1, rendition, syncFlatIndex)

    expect(syncFlatIndex).toHaveBeenCalledWith(1)
    expect(scrollEpubChapterInRendition).toHaveBeenCalled()
    expect(display).not.toHaveBeenCalled()
  })

  it('MOBI 同 chapter.id：点下一 flatIndex 只滚动不 reload', async () => {
    const chapters: MobiChapterItem[] = [
      { id: '2', label: '第一章 佟家的奴才', level: 0 },
      { id: '2', label: '战场上的俘虏', level: 1 },
    ]

    const syncFlatIndex = vi.fn()
    const scrollToFlatIndex = vi.fn().mockReturnValue(true)
    const loadChapterById = vi.fn().mockResolvedValue(true)

    const ok = await navigateMobiToFlatIndex({
      chapters,
      flatIndex: 1,
      currentChapterId: '2',
      getDocument: () => window.document,
      syncFlatIndex,
      scrollToFlatIndex,
      loadChapterById,
    })

    expect(ok).toBe(true)
    expect(syncFlatIndex).toHaveBeenCalledWith(1)
    expect(scrollToFlatIndex).toHaveBeenCalledWith(window.document, 1)
    expect(loadChapterById).not.toHaveBeenCalled()
  })
})
