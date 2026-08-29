// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { flattenEpubToc } from '@/lib/epub-navigation'
import { useReaderNavigationStore, selectReaderNavTitles } from '@/stores/reader-navigation-store'

function buildGovernanceChapterDocument(): Document {
  const document = window.document
  document.body.innerHTML = `
    <section id="chapter2"><h2>第2章 国家治理逻辑</h2></section>
    <section id="summary"><h3>讨论与小结</h3></section>
  `

  const scrollRoot = document.scrollingElement ?? document.documentElement
  Object.defineProperty(scrollRoot, 'clientHeight', { configurable: true, value: 800 })
  Object.defineProperty(scrollRoot, 'scrollTop', { configurable: true, value: 900, writable: true })

  for (const [id, top] of [
    ['chapter2', 1200],
    ['summary', 4800],
  ] as const) {
    const element = document.getElementById(id)
    if (!element) continue
    Object.defineProperty(element, 'offsetTop', { configurable: true, value: top })
  }

  return document
}

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

  it('EPUB 视口同步后，useReaderNavTitles 与 store.nav 一致（工具栏/底部同源）', () => {
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
    const document = buildGovernanceChapterDocument()

    useReaderNavigationStore.getState().syncEpubViewport(chapters, document, 'text00002.html')

    const storeState = useReaderNavigationStore.getState()
    const titles = selectReaderNavTitles(storeState)

    expect(titles.currentTitle).toBe(storeState.nav.current?.label)
    expect(titles.previousTitle).toBe(storeState.nav.previous?.label ?? '—')
    expect(titles.nextTitle).toBe(storeState.nav.next?.label ?? '—')
    expect(titles.currentTitle).toBe('第2章 国家治理逻辑')
    expect(titles.currentUnitId).toBe('text00002.html#chapter2')
  })

  it('MOBI syncMobi 后 currentUnitId 使用 mobi-toc 编码', () => {
    const chapters = [
      { id: '0', label: '目录', level: 0 },
      { id: '1', label: '第一章', level: 0 },
      { id: '2', label: '第二章', level: 0 },
    ]

    useReaderNavigationStore.getState().syncMobi(chapters, '2', 2)
    const titles = selectReaderNavTitles(useReaderNavigationStore.getState())

    expect(titles.currentTitle).toBe('第二章')
    expect(titles.currentUnitId).toBe('mobi-toc:2')
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
})
