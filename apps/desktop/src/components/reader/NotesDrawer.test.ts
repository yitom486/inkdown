// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotesDrawer } from './NotesDrawer'
import type { ReadingMark } from '@inkdown/contracts'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('NotesDrawer', () => {
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
      id: 'note-1',
      filePath: '/book.pdf',
      fileFingerprint: 'fp-1',
      kind: 'note',
      category: 'concept',
      title: 'Paxos 核心共识',
      note: '两阶段提交与多数派 Quorum',
      excerpt: '多数派投票原则',
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      anchor: { format: 'pdf', page: 1 },
    },
    {
      id: 'note-2',
      filePath: '/book.pdf',
      fileFingerprint: 'fp-1',
      kind: 'highlight',
      category: 'quote',
      title: '分布式真理',
      note: 'CAP 定理的本质取舍',
      excerpt: '分区容忍性不可避免',
      createdAt: 1710000001000,
      updatedAt: 1710000001000,
      anchor: { format: 'pdf', page: 2 },
    },
  ]

  it('renders drawer header and cards list when open', async () => {
    const onClose = vi.fn()

    await act(async () => {
      root.render(
        createElement(NotesDrawer, {
          isOpen: true,
          onClose,
          marks: mockMarks,
          bookTitle: '分布式系统原理',
        })
      )
    })

    expect(container.textContent).toContain('全书札记与知识箱')
    expect(container.textContent).toContain('分布式系统原理')
    expect(container.textContent).toContain('Paxos 核心共识')
    expect(container.textContent).toContain('分布式真理')
  })

  it('filters cards by category tabs', async () => {
    const onClose = vi.fn()

    await act(async () => {
      root.render(
        createElement(NotesDrawer, {
          isOpen: true,
          onClose,
          marks: mockMarks,
          bookTitle: '分布式系统原理',
        })
      )
    })

    const quoteTab = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === '引用'
    )
    expect(quoteTab).toBeDefined()

    await act(async () => {
      quoteTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('分布式真理')
    expect(container.textContent).not.toContain('Paxos 核心共识')
  })

  it('does not render when isOpen is false', async () => {
    await act(async () => {
      root.render(
        createElement(NotesDrawer, {
          isOpen: false,
          onClose: vi.fn(),
          marks: mockMarks,
        })
      )
    })

    expect(container.textContent).toBe('')
  })
})
