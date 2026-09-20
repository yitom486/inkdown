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
    const onGenerateCardPreset = vi.fn()
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
          onGenerateCardPreset,
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

  it('opens preset menu on智能制卡 and picks a preset', async () => {
    const onGenerateCardPreset = vi.fn()
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
          onGenerateCardPreset,
          onDismiss,
        }),
      )
    })

    const buttons = Array.from(container.querySelectorAll('button'))
    const cardBtn = buttons.find((b) => b.textContent?.includes('智能制卡'))
    expect(cardBtn).toBeDefined()

    // 点一次只开菜单，不直接制卡（选择题，不抢答）
    await act(async () => {
      cardBtn?.click()
    })
    expect(onGenerateCardPreset).not.toHaveBeenCalled()
    expect(container.textContent).toContain('通用提炼')

    const menuButtons = Array.from(container.querySelectorAll('[role="menuitem"]'))
    const distill = menuButtons.find((b) => b.textContent?.includes('通用提炼'))
    expect(distill).toBeDefined()
    await act(async () => {
      ;(distill as HTMLButtonElement)?.click()
    })

    expect(onGenerateCardPreset).toHaveBeenCalledTimes(1)
    expect(onGenerateCardPreset).toHaveBeenCalledWith('distill', undefined)
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
