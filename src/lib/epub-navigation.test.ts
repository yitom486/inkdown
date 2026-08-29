import { describe, expect, it } from 'vitest'
import {
  findLastEpubFlatIndex,
  flattenEpubToc,
  isTocLikeChapter,
  pickInitialChapter,
  resolveChapterNav,
} from '@/lib/epub-navigation'

/** 复现《中国国家治理的制度逻辑》一类：一级仅「目录」，正文挂在二级 */
function buildGovernanceToc() {
  return flattenEpubToc([
    {
      label: '目录',
      href: 'text00001.html',
      subitems: [
        { label: '自序', href: 'text00001.html#toc_id_1' },
        { label: '第1章 导论：中国国家治理的制度逻辑', href: 'text00002.html' },
        { label: '第2章 中国政府组织结构', href: 'text00003.html' },
        { label: '第3章 委托代理关系', href: 'text00004.html' },
      ],
    },
  ])
}

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

  it('位于二级小节时下一章仍跳到下一同级标题', () => {
    const nested = flattenEpubToc([
      { label: '第一章', href: 'ch1.xhtml', subitems: [{ label: '一、小引', href: 'ch1.xhtml#intro' }] },
      { label: '第二章', href: 'ch2.xhtml' },
    ])
    const nav = resolveChapterNav(nested, 'ch1.xhtml#intro')
    expect(nav.current?.label).toBe('第一章')
    expect(nav.next?.label).toBe('第二章')
  })

  describe('目录下挂自序/章（用户书回归）', () => {
    const nested = buildGovernanceToc()

    it('带 toc_ 前缀的 fragment 不会把自序误判为目录页', () => {
      expect(isTocLikeChapter(nested[1]!)).toBe(false)
      expect(isTocLikeChapter(nested[0]!)).toBe(true)
    })

    it('初始打开落在自序而非目录', () => {
      expect(pickInitialChapter(nested)?.label).toBe('自序')
    })

    it('无 fragment 的同文件 href 匹配到自序而不是目录', () => {
      expect(findLastEpubFlatIndex(nested, 'text00001.html')).toBe(1)
      expect(nested[1]?.label).toBe('自序')
    })

    it('阅读自序时底部导航显示自序，下一章为第1章', () => {
      const nav = resolveChapterNav(nested, 'text00001.html')
      expect(nav.current?.label).toBe('自序')
      expect(nav.next?.label).toBe('第1章 导论：中国国家治理的制度逻辑')
      expect(nav.previous).toBeNull()
    })

    it('带 fragment 的自序位置同样识别为自序', () => {
      const nav = resolveChapterNav(nested, 'text00001.html#toc_id_1')
      expect(nav.current?.label).toBe('自序')
      expect(nav.next?.label).toContain('第1章')
    })

    it('在第1章时上一章为自序、下一章为第2章（按二级标题跳转）', () => {
      const nav = resolveChapterNav(nested, 'text00002.html')
      expect(nav.current?.label).toContain('第1章')
      expect(nav.previous?.label).toBe('自序')
      expect(nav.next?.label).toContain('第2章')
    })

    it('上一章/下一章不会落回「目录」占位项', () => {
      const fromPreface = resolveChapterNav(nested, 'text00001.html')
      const fromCh1 = resolveChapterNav(nested, 'text00002.html')

      expect(fromPreface.previous).toBeNull()
      expect(fromPreface.next?.label).not.toMatch(/^目录$/)
      expect(fromCh1.previous?.label).not.toMatch(/^目录$/)
      expect(fromCh1.current?.label).not.toMatch(/^目录$/)
    })
  })
})
