// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { flattenEpubToc } from '@/lib/epub-navigation'
import { navigateEpubToFlatIndex } from '@/lib/reader-flat-nav'

const scrollEpubChapterInRendition = vi.fn()

vi.mock('@/lib/epub-scroll-toc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/epub-scroll-toc')>()
  return {
    ...actual,
    scrollEpubChapterInRendition: (...args: unknown[]) => scrollEpubChapterInRendition(...args),
  }
})

describe('navigateEpubToFlatIndex', () => {
  it('同 spine：侧栏点小节只滚动不 display', () => {
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
})
