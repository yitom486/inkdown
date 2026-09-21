// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeepAnswerDialog } from './DeepAnswerDialog'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('DeepAnswerDialog', () => {
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

  const data = {
    directionLabel: '深入解释',
    excerpt: '选段原文',
    answer: '这是**答案**正文',
  }

  it('展示方向、选段与答案，按钮回调查找', async () => {
    const onClose = vi.fn()
    const onRetry = vi.fn()
    const onSaveAsNote = vi.fn()

    await act(async () => {
      root.render(
        createElement(DeepAnswerDialog, {
          data,
          pending: false,
          onClose,
          onRetry,
          onSaveAsNote,
        }),
      )
    })

    // radix Dialog 经 portal 挂 document.body，不在 render container 内
    const body = document.body.textContent ?? ''
    expect(body).toContain('深入解释')
    expect(body).toContain('选段原文')
    expect(body).toContain('答案')

    const buttons = Array.from(document.body.querySelectorAll('button'))
    const save = buttons.find((b) => b.textContent?.includes('存为卡片批注'))
    expect(save).toBeDefined()
    await act(async () => {
      ;(save as HTMLButtonElement)?.click()
    })
    expect(onSaveAsNote).toHaveBeenCalledTimes(1)

    const retry = buttons.find((b) => b.textContent?.includes('换一版'))
    await act(async () => {
      ;(retry as HTMLButtonElement)?.click()
    })
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('pending 显示加载态且操作禁用', async () => {
    await act(async () => {
      root.render(
        createElement(DeepAnswerDialog, {
          data: { ...data, answer: '' },
          pending: true,
          onClose: vi.fn(),
          onRetry: vi.fn(),
          onSaveAsNote: vi.fn(),
        }),
      )
    })

    expect(document.body.textContent).toContain('正在研读作答')
    const save = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('存为卡片批注'),
    )
    expect((save as HTMLButtonElement)?.disabled).toBe(true)
  })
})
