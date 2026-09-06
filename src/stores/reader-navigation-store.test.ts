// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { flattenEpubToc } from '@/lib/reader/epub-navigation'
import { useReaderNavigationStore, selectReaderNavTitles } from '@/stores/reader-navigation-store'

describe('reader-navigation-store', () => {
  beforeEach(() => {
    useReaderNavigationStore.getState().beginSession('', 'epub')
  })

  it('beginSession 重置 nav，避免跨文件残留', () => {
    const chapters = flattenEpubToc([
      { label: '第一章', href: 'ch1.xhtml' },
      { label: '第二章', href: 'ch2.xhtml' },
    ])
    useReaderNavigationStore.getState().syncEpub(chapters, { href: 'ch2.xhtml' })
    expect(useReaderNavigationStore.getState().nav.current?.label).toBe('第二章')

    useReaderNavigationStore.getState().beginSession('/other/book.epub', 'epub')
    expect(useReaderNavigationStore.getState().nav.current).toBeNull()
    expect(useReaderNavigationStore.getState().filePath).toBe('/other/book.epub')
  })

  it('EPUB 同步后，useReaderNavTitles 与 store.nav 一致（工具栏/底部同源）', () => {
    const chapters = flattenEpubToc([
      {
        label: '第一单元',
        href: 'text00002.html',
        subitems: [
          { label: '第2章 国家治理逻辑', href: 'text00002.html#chapter2' },
          { label: '讨论与小结', href: 'text00002.html#summary' },
        ],
      },
    ])

    useReaderNavigationStore.getState().syncEpub(chapters, { href: 'text00002.html#chapter2' })

    const storeState = useReaderNavigationStore.getState()
    const titles = selectReaderNavTitles(storeState)

    expect(titles.currentTitle).toBe(storeState.nav.current?.label)
    expect(titles.previousTitle).toBe(storeState.nav.previous?.label ?? '—')
    expect(titles.nextTitle).toBe(storeState.nav.next?.label ?? '—')
    // 章节粒度回溯到单元，但 currentUnitId 保留精确定位
    expect(titles.currentTitle).toBe('第一单元')
    expect(titles.currentUnitId).toBe('text00002.html#chapter2')
  })

  it('同一位置重复 sync 不会改写 store（避免滚动风暴）', () => {
    const chapters = flattenEpubToc([
      { label: '第一章', href: 'ch1.xhtml' },
      { label: '第二章', href: 'ch2.xhtml' },
    ])
    useReaderNavigationStore.getState().syncEpub(chapters, { href: 'ch2.xhtml' })
    const first = useReaderNavigationStore.getState().nav

    useReaderNavigationStore.getState().syncEpub(chapters, { href: 'ch2.xhtml' })
    expect(useReaderNavigationStore.getState().nav).toBe(first)
  })

  it('selectReaderNavTitles 只返回原始字段，不含 nav 对象引用', () => {
    const chapters = flattenEpubToc([{ label: '第一章', href: 'ch1.xhtml' }])
    useReaderNavigationStore.getState().syncEpub(chapters, { href: 'ch1.xhtml' })
    const titles = selectReaderNavTitles(useReaderNavigationStore.getState())
    expect(titles).not.toHaveProperty('nav')
    expect(titles.currentTitle).toBe('第一章')
  })

  it('syncFlatIndex 后记录 intent，供视口回调查阅（加载后仍显示用户点的节）', () => {
    const chapters = flattenEpubToc([
      { label: '第一部分', href: 'part1.html' },
      { label: '第一章 佟家的奴才', href: 'ch1.html' },
      { label: '战场上的俘虏', href: 'ch1.html#prisoners' },
    ])

    useReaderNavigationStore.getState().setUnits(chapters)
    useReaderNavigationStore.getState().syncFlatIndex(1)

    expect(useReaderNavigationStore.getState().nav.current?.label).toContain('第一章')
    expect(useReaderNavigationStore.getState().navIntent?.flatIndex).toBe(1)
  })
})
