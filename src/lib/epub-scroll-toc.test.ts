// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { flattenEpubToc, resolveChapterNav } from '@/lib/epub-navigation'
import { findEpubFlatIndexFromViewport } from '@/lib/epub-scroll-toc'

function buildMonolithicChapterToc() {
  return flattenEpubToc([
    { label: '目录', href: 'nav.xhtml' },
    {
      label: '第1章 导论',
      href: 'chapter01.html',
      subitems: [
        { label: '自序', href: 'chapter01.html#preface' },
        { label: '问题提出', href: 'chapter01.html#intro' },
        { label: '讨论与小结', href: 'chapter01.html#summary' },
      ],
    },
    { label: '第2章 组织结构', href: 'chapter02.html' },
  ])
}

function buildMonolithicDocument(): Document {
  const document = window.document
  document.body.innerHTML = `
    <section id="preface"><h2>自序</h2></section>
    <section id="intro"><h2>问题提出</h2></section>
    <section id="summary"><h2>讨论与小结</h2></section>
  `

  const scrollRoot = document.scrollingElement ?? document.documentElement
  Object.defineProperty(scrollRoot, 'clientHeight', { configurable: true, value: 800 })
  Object.defineProperty(scrollRoot, 'scrollTop', { configurable: true, value: 0, writable: true })

  for (const [id, top] of [
    ['preface', 0],
    ['intro', 1200],
    ['summary', 4800],
  ] as const) {
    const element = document.getElementById(id)
    if (!element) continue
    Object.defineProperty(element, 'offsetTop', { configurable: true, value: top })
  }

  return document
}

function buildGovernanceChapterDocument(): Document {
  const document = window.document
  document.body.innerHTML = `
    <section id="unit1"><h1>第一单元</h1></section>
    <section id="chapter2"><h2>第2章 国家治理逻辑与中国官僚制</h2><p>正文…</p></section>
    <section id="summary"><h3>讨论与小结</h3><p>小结…</p></section>
  `

  const scrollRoot = document.scrollingElement ?? document.documentElement
  Object.defineProperty(scrollRoot, 'clientHeight', { configurable: true, value: 800 })
  Object.defineProperty(scrollRoot, 'scrollTop', { configurable: true, value: 0, writable: true })

  for (const [id, top] of [
    ['unit1', 0],
    ['chapter2', 1200],
    ['summary', 4800],
  ] as const) {
    const element = document.getElementById(id)
    if (!element) continue
    Object.defineProperty(element, 'offsetTop', { configurable: true, value: top })
  }

  return document
}

describe('epub-scroll-toc', () => {
  const monolithic = buildMonolithicChapterToc()

  it('视口在章节开头时匹配自序而非讨论与小结', () => {
    const document = buildMonolithicDocument()
    const scrollRoot = document.scrollingElement ?? document.documentElement
    scrollRoot.scrollTop = 0

    const index = findEpubFlatIndexFromViewport(monolithic, document, 'chapter01.html')
    expect(monolithic[index]?.label).toBe('自序')
  })

  it('视口滚到讨论与小结时匹配对应 TOC', () => {
    const document = buildMonolithicDocument()
    const scrollRoot = document.scrollingElement ?? document.documentElement
    scrollRoot.scrollTop = 4700

    const index = findEpubFlatIndexFromViewport(monolithic, document, 'chapter01.html')
    expect(monolithic[index]?.label).toBe('讨论与小结')
  })

  it('同 HTML 多节：视口在第2章锚点时底部导航应显示第2章而非讨论与小结', () => {
    const chapters = flattenEpubToc([
      { label: '目录', href: 'nav.xhtml' },
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
    const scrollRoot = document.scrollingElement ?? document.documentElement
    scrollRoot.scrollTop = 900

    const index = findEpubFlatIndexFromViewport(chapters, document, 'text00002.html')
    expect(chapters[index]?.label).toBe('第2章 国家治理逻辑')

    const nav = resolveChapterNav(chapters, undefined, index)
    expect(nav.current?.label).toBe('第2章 国家治理逻辑')
    expect(nav.next?.label).toBe('讨论与小结')
  })
})
