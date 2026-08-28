import { describe, expect, it } from 'vitest'
import {
  flattenEpubToc,
  isTocLikeChapter,
  pickInitialChapter,
  resolveChapterNav,
} from '@/lib/epub-navigation'

describe('epub-navigation', () => {
  const chapters = flattenEpubToc([
    { label: '目录', href: 'nav.xhtml' },
    { label: '第一章', href: 'ch1.xhtml' },
    { label: '第二章', href: 'ch2.xhtml' },
  ])

  it('展平目录并跳过目录页作为起始章', () => {
    expect(chapters).toHaveLength(3)
    expect(isTocLikeChapter(chapters[0]!)).toBe(true)
    expect(pickInitialChapter(chapters)?.label).toBe('第一章')
  })

  it('解析当前章节与前后章', () => {
    const nav = resolveChapterNav(chapters, 'ch2.xhtml')
    expect(nav.current?.label).toBe('第二章')
    expect(nav.previous?.label).toBe('第一章')
    expect(nav.next).toBeNull()
  })
})
