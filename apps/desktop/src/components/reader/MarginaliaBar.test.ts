// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarginaliaBar } from './MarginaliaBar'
import type { ReadingMark } from '@inkdown/contracts'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('MarginaliaBar', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  const mockMarks: ReadingMark[] = [
    {
      id: 'mark-concept-1',
      filePath: '/book.epub',
      fileFingerprint: 'fp-1',
      kind: 'note',
      category: 'concept',
      title: '分布式共识',
      note: 'Raft 与 Paxos 核心算法对比',
      excerpt: '多数派投票原则',
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      anchor: { format: 'epub', cfi: 'epubcfi(/6/2)' },
    },
    {
      id: 'mark-quote-1',
      filePath: '/book.epub',
      fileFingerprint: 'fp-1',
      kind: 'highlight',
      category: 'quote',
      title: '经典名句',
      note: '架构设计就是关于取舍的艺术',
      excerpt: '取舍的艺术',
      createdAt: 1710000001000,
      updatedAt: 1710000001000,
      anchor: { format: 'epub', cfi: 'epubcfi(/6/4)' },
    },
    {
      id: 'mark-diagram-1',
      filePath: '/book.epub',
      fileFingerprint: 'fp-1',
      kind: 'note',
      category: 'diagram',
      diagramId: 'diag-123',
      title: '握手时序图谱',
      note: '客户端与服务端协商时序',
      excerpt: '三次握手流程',
      createdAt: 1710000002000,
      updatedAt: 1710000002000,
      anchor: { format: 'epub', cfi: 'epubcfi(/6/6)' },
    },
  ]

  it('renders mark categories, counts and titles accurately', async () => {
    const onMarkClick = vi.fn()
    const onToggleCardCollapse = vi.fn()
    const onToggleAllCollapse = vi.fn()

    await act(async () => {
      root.render(
        createElement(MarginaliaBar, {
          marks: mockMarks,
          onMarkClick,
          onToggleCardCollapse,
          onToggleAllCollapse,
        })
      )
    })

    expect(container.textContent).toContain('知识卡片')
    expect(container.textContent).toContain('全部 (3)')
    expect(container.textContent).toContain('概念 (1)')
    expect(container.textContent).toContain('引用 (1)')
    expect(container.textContent).toContain('图谱 (1)')
    expect(container.textContent).toContain('分布式共识')
    expect(container.textContent).toContain('经典名句')
    expect(container.textContent).toContain('握手时序图谱')
  })

  it('filters cards when category button is clicked', async () => {
    const onMarkClick = vi.fn()
    const onToggleCardCollapse = vi.fn()
    const onToggleAllCollapse = vi.fn()

    await act(async () => {
      root.render(
        createElement(MarginaliaBar, {
          marks: mockMarks,
          onMarkClick,
          onToggleCardCollapse,
          onToggleAllCollapse,
        })
      )
    })

    const conceptBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('概念 (1)')
    )
    expect(conceptBtn).toBeDefined()

    await act(async () => {
      conceptBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('分布式共识')
    expect(container.textContent).not.toContain('经典名句')
  })

  it('triggers onMarkClick and onOpenDiagram', async () => {
    const onMarkClick = vi.fn()
    const onToggleCardCollapse = vi.fn()
    const onToggleAllCollapse = vi.fn()
    const onOpenDiagram = vi.fn()

    await act(async () => {
      root.render(
        createElement(MarginaliaBar, {
          marks: mockMarks,
          onMarkClick,
          onToggleCardCollapse,
          onToggleAllCollapse,
          onOpenDiagram,
        })
      )
    })

    const card = container.querySelector('#card-mark-concept-1') as HTMLElement
    expect(card).toBeDefined()

    await act(async () => {
      card.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onMarkClick).toHaveBeenCalledWith(mockMarks[0])

    const diagramBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('展开时序图')
    )
    expect(diagramBtn).toBeDefined()

    await act(async () => {
      diagramBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onOpenDiagram).toHaveBeenCalledWith('diag-123')
  })

  it('shows chapter source and dims cards outside current chapter', async () => {
    const chapterOfMark = (mark: ReadingMark) =>
      mark.id === 'mark-concept-1'
        ? { key: 'ch1', label: '第一章 北美的外貌' }
        : { key: 'ch2', label: '第二章 民主的起源' }

    await act(async () => {
      root.render(
        createElement(MarginaliaBar, {
          marks: mockMarks,
          onMarkClick: vi.fn(),
          onToggleCardCollapse: vi.fn(),
          onToggleAllCollapse: vi.fn(),
          chapterOfMark,
          currentChapterKey: 'ch1',
        })
      )
    })

    // 主人露脸：每张卡都标出章节归属
    expect(container.textContent).toContain('第一章 北美的外貌')
    expect(container.textContent).toContain('第二章 民主的起源')
    // 非本章卡致灰
    const other = container.querySelector('#card-mark-quote-1')?.parentElement?.parentElement
    expect(other?.className).toContain('opacity-55')
  })
})
