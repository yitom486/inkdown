// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectionToolbar } from './SelectionToolbar'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('SelectionToolbar', () => {
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

  it('renders copy, highlight, annotate, card, and ask agent buttons', async () => {
    const onCopy = vi.fn()
    const onAnnotate = vi.fn()
    const onHighlight = vi.fn()
    const onGenerateCard = vi.fn()
    const onAskAgent = vi.fn()
    const onDismiss = vi.fn()

    await act(async () => {
      root.render(
        createElement(SelectionToolbar, {
          x: 100,
          y: 200,
          onCopy,
          onAnnotate,
          onHighlight,
          onGenerateCard,
          onAskAgent,
          onDismiss,
        }),
      )
    })

    expect(container.textContent).toContain('复制')
    expect(container.textContent).toContain('高亮')
    expect(container.textContent).toContain('批注')
    expect(container.textContent).toContain('智能制卡')
    expect(container.textContent).toContain('深度问答')
  })

  it('calls onGenerateCard when clicking智能制卡', async () => {
    const onGenerateCard = vi.fn()
    const onCopy = vi.fn()
    const onAnnotate = vi.fn()
    const onDismiss = vi.fn()

    await act(async () => {
      root.render(
        createElement(SelectionToolbar, {
          x: 100,
          y: 200,
          onCopy,
          onAnnotate,
          onGenerateCard,
          onDismiss,
        }),
      )
    })

    const buttons = Array.from(container.querySelectorAll('button'))
    const cardBtn = buttons.find((b) => b.textContent?.includes('智能制卡'))
    expect(cardBtn).toBeDefined()

    await act(async () => {
      cardBtn?.click()
    })

    expect(onGenerateCard).toHaveBeenCalledTimes(1)
  })

  it('calls onHighlight with color when clicking color dot', async () => {
    const onHighlight = vi.fn()
    const onCopy = vi.fn()
    const onAnnotate = vi.fn()
    const onDismiss = vi.fn()

    await act(async () => {
      root.render(
        createElement(SelectionToolbar, {
          x: 100,
          y: 200,
          onCopy,
          onAnnotate,
          onHighlight,
          onDismiss,
        }),
      )
    })

    const colorBtn = container.querySelector('button[aria-label^="划重点"]') as HTMLButtonElement
    expect(colorBtn).not.toBeNull()

    await act(async () => {
      colorBtn.click()
    })

    expect(onHighlight).toHaveBeenCalledTimes(1)
  })
})
