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

  it('opens answer menu on深度问答, picks direction or composer', async () => {
    const onAskDeepAnswer = vi.fn()
    const onAskAgent = vi.fn()
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
          onAskAgent,
          onAskDeepAnswer,
          onDismiss,
        }),
      )
    })

    const buttons = Array.from(container.querySelectorAll('button'))
    const askBtn = buttons.find((b) => b.textContent?.includes('深度问答'))
    expect(askBtn).toBeDefined()
    await act(async () => {
      askBtn?.click()
    })
    expect(onAskDeepAnswer).not.toHaveBeenCalled()

    const explain = Array.from(container.querySelectorAll('[role="menuitem"]')).find((b) =>
      b.textContent?.includes('深入解释'),
    )
    expect(explain).toBeDefined()
    await act(async () => {
      ;(explain as HTMLButtonElement)?.click()
    })
    expect(onAskDeepAnswer).toHaveBeenCalledTimes(1)
    expect(onAskDeepAnswer).toHaveBeenCalledWith('explain')

    // composer 入口保留（交互式不动）：重开菜单点末项
    await act(async () => {
      askBtn?.click()
    })
    const composer = Array.from(container.querySelectorAll('[role="menu"] button')).find((b) =>
      b.textContent?.includes('去 Agent 面板细问'),
    )
    expect(composer).toBeDefined()
    await act(async () => {
      ;(composer as HTMLButtonElement)?.click()
    })
    expect(onAskAgent).toHaveBeenCalledTimes(1)
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
