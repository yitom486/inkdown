// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { flattenEpubToc, resolveChapterNav } from '@/lib/reader/epub-navigation'
import { findEpubFlatIndexFromViewport } from '@/lib/reader/epub-scroll-toc'

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

import { mockRelativeOffsetTop, mockScrollRoot } from '@/lib/reader/reader-viewport-test-helpers'

function buildMonolithicDocument(scrollTop = 0): Document {
  const document = window.document
  document.body.innerHTML = `
    <section id="preface"><h2>自序</h2></section>
    <section id="intro"><h2>问题提出</h2></section>
    <section id="summary"><h2>讨论与小结</h2></section>
  `
  mockScrollRoot(document, scrollTop)
  for (const [id, top] of [
    ['preface', 0],
    ['intro', 1200],
    ['summary', 4800],
  ] as const) {
    const element = document.getElementById(id)
    if (element instanceof HTMLElement) mockRelativeOffsetTop(element, top, 40)
  }
  return document
}

function buildGovernanceChapterDocument(scrollTop = 0): Document {
  const document = window.document
  document.body.innerHTML = `
    <section id="unit1"><h1>第一单元</h1></section>
    <section id="chapter2"><h2>第2章 国家治理逻辑与中国官僚制</h2><p>正文…</p></section>
    <section id="summary"><h3>讨论与小结</h3><p>小结…</p></section>
  `
  mockScrollRoot(document, scrollTop)
  const scrollRoot = document.scrollingElement as HTMLElement
  for (const [id, top] of [
    ['unit1', 0],
    ['chapter2', 1200],
    ['summary', 4800],
  ] as const) {
    const element = document.getElementById(id)
    if (element instanceof HTMLElement) mockRelativeOffsetTop(element, top, 40)
  }
  return document
}

describe('epub-scroll-toc', () => {
  const monolithic = buildMonolithicChapterToc()

  it('视口在章节开头时匹配自序而非讨论与小结', () => {
    const document = buildMonolithicDocument(0)

    const index = findEpubFlatIndexFromViewport(monolithic, document, 'chapter01.html')
    expect(monolithic[index]?.label).toBe('自序')
  })

  it('视口滚到讨论与小结时匹配对应 TOC', () => {
    const document = buildMonolithicDocument(4700)

    const index = findEpubFlatIndexFromViewport(monolithic, document, 'chapter01.html')
    expect(monolithic[index]?.label).toBe('讨论与小结')
  })

    it('下一节标题滚过激活线后才切到研究策略', () => {
      const chapters = flattenEpubToc([
        { label: '导言', href: 'intro.html#preface' },
        { label: '研究策略', href: 'intro.html#strategy' },
      ])

      const document = window.document
      document.body.innerHTML = `
        <section id="preface"><h2>导言</h2><p>导言正文</p></section>
        <section id="strategy"><h2>研究策略</h2><p>策略正文</p></section>
      `
      mockScrollRoot(document, 1300)
      const scrollRoot = document.scrollingElement as HTMLElement
      for (const [id, top, height] of [
        ['preface', 0, 1200],
        ['strategy', 1400, 400],
      ] as const) {
        const element = document.getElementById(id)
        if (element instanceof HTMLElement) mockRelativeOffsetTop(element, top, height)
      }

      const index = findEpubFlatIndexFromViewport(chapters, document, 'intro.html')
      expect(chapters[index]?.label).toBe('研究策略')
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

    const document = buildGovernanceChapterDocument(900)

    const index = findEpubFlatIndexFromViewport(chapters, document, 'text00002.html')
    expect(chapters[index]?.label).toBe('第2章 国家治理逻辑')

    const nav = resolveChapterNav(chapters, undefined, index)
    expect(chapters[index]?.label).toBe('第2章 国家治理逻辑')
    expect(nav.current?.label).toBe('第一单元')
    expect(nav.next).toBeNull()
    expect(nav.flatIndex).toBe(index)
  })
})
