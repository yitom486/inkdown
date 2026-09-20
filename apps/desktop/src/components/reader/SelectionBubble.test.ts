// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectionBubble } from './SelectionBubble'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('SelectionBubble', () => {
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

  it('renders null when position or selectedText is missing', async () => {
    await act(async () => {
      root.render(
        createElement(SelectionBubble, {
          position: null,
          selectedText: '',
          onClose: vi.fn(),
        }),
      )
    })

    expect(container.querySelector('#selection-quick-bubble')).toBeNull()
  })

  it('renders all quick action buttons when text is selected', async () => {
    await act(async () => {
      root.render(
        createElement(SelectionBubble, {
          position: { x: 200, y: 300 },
          selectedText: 'Distributed consensus algorithm',
          onGenerateCardPreset: vi.fn(),
          onClose: vi.fn(),
        }),
      )
    })

    const bubble = container.querySelector('#selection-quick-bubble')
    expect(bubble).not.toBeNull()
    expect(container.textContent).toContain('解释')
    expect(container.textContent).toContain('摘要')
    expect(container.textContent).toContain('生成卡片')
    expect(container.textContent).toContain('对比')
    expect(container.textContent).toContain('提问')
  })

  it('triggers onAskAgent when 解释 is clicked', async () => {
    const onAskAgent = vi.fn()
    const onClose = vi.fn()

    await act(async () => {
      root.render(
        createElement(SelectionBubble, {
          position: { x: 200, y: 300 },
          selectedText: 'Paxos algorithm',
          onAskAgent,
          onClose,
        }),
      )
    })

    const explainBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('解释'),
    )
    expect(explainBtn).toBeDefined()

    await act(async () => {
      explainBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onAskAgent).toHaveBeenCalledWith(expect.stringContaining('Paxos algorithm'))
    expect(onClose).toHaveBeenCalled()
  })

  it('opens preset menu on 生成卡片 and picks without closing bubble', async () => {
    const onGenerateCardPreset = vi.fn()
    const onClose = vi.fn()

    await act(async () => {
      root.render(
        createElement(SelectionBubble, {
          position: { x: 200, y: 300 },
          selectedText: 'Core concept excerpt',
          onGenerateCardPreset,
          onClose,
        }),
      )
    })

    const cardBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('生成卡片'),
    )
    expect(cardBtn).toBeDefined()

    await act(async () => {
      cardBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    // 只开菜单（气泡保留，选区不丢）
    expect(onGenerateCardPreset).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    const concept = Array.from(container.querySelectorAll('[role="menuitem"]')).find((b) =>
      b.textContent?.includes('概念界定'),
    )
    expect(concept).toBeDefined()
    await act(async () => {
      concept?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onGenerateCardPreset).toHaveBeenCalledTimes(1)
    expect(onGenerateCardPreset).toHaveBeenCalledWith('concept', undefined)
  })

  it('opens color palette and triggers onHighlight when color is selected', async () => {
    const onHighlight = vi.fn()
    const onClose = vi.fn()

    await act(async () => {
      root.render(
        createElement(SelectionBubble, {
          position: { x: 200, y: 300 },
          selectedText: 'Important sentence',
          onHighlight,
          onClose,
        }),
      )
    })

    const highlighterBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('title') === '划线重点',
    )
    expect(highlighterBtn).toBeDefined()

    await act(async () => {
      highlighterBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const greenBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('title')?.includes('苍苔浅绿'),
    )
    expect(greenBtn).toBeDefined()

    await act(async () => {
      greenBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onHighlight).toHaveBeenCalledWith('Important sentence', 'green')
    expect(onClose).toHaveBeenCalled()
  })
})
