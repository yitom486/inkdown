// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BookDbBlockHit } from '@shared/types/book-db'

const { mockQueryBook } = vi.hoisted(() => ({ mockQueryBook: vi.fn() }))

vi.mock('@/api/rosetta-api', () => ({
  rosettaApi: { queryBook: mockQueryBook },
}))

import { PdfBookSearch } from './PdfBookSearch'

(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

function hit(over: Partial<BookDbBlockHit> = {}): BookDbBlockHit {
  return {
    id: 1,
    type: 'paragraph',
    content: '移码表示法用于阶码',
    pageNumber: 36,
    chapterIndex: 1,
    chapterTitle: '第2章',
    blockIndex: 0,
    snippet: '',
    ...over,
  }
}

function searchOk(blocks: BookDbBlockHit[]) {
  return { ok: true as const, value: { kind: 'search' as const, blocks } }
}

async function renderSearch(props: { fingerprint?: string; indexed?: boolean; onJump?: (page: number) => void }) {
  const onJumpToPage = props.onJump ?? vi.fn()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const renderProps = (nextFingerprint: string) =>
    createElement(PdfBookSearch, {
      fingerprint: nextFingerprint,
      indexed: props.indexed ?? true,
      onJumpToPage,
    })
  await act(async () => {
    root.render(renderProps(props.fingerprint ?? 'fp-1'))
  })
  return {
    container,
    onJumpToPage: onJumpToPage as ReturnType<typeof vi.fn>,
    unmount: async () => {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    },
    rerender: async (nextFingerprint: string) => {
      await act(async () => {
        root.render(renderProps(nextFingerprint))
      })
    },
  }
}

function typeInto(input: HTMLInputElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, text)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

afterEach(() => {
  mockQueryBook.mockReset()
  document.body.innerHTML = ''
})

describe('PdfBookSearch', () => {
  it('短词禁用按钮，Enter 不请求并提示', async () => {
    const view = await renderSearch({})
    const input = view.container.querySelector('input') as HTMLInputElement
    const button = view.container.querySelector('button[title*="搜索正文"]') as HTMLButtonElement
    await act(async () => {
      typeInto(input, '王道')
    })
    expect(button.disabled).toBe(true)
    expect(view.container.textContent).toContain('至少输入 3 个字符')
    await act(async () => {
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(mockQueryBook).not.toHaveBeenCalled()
    await view.unmount()
  })

  it('按钮搜索传参正确，点击结果跳页并关闭面板', async () => {
    mockQueryBook.mockResolvedValue(searchOk([hit({ id: 7, pageNumber: 36 })]))
    const view = await renderSearch({})
    const input = view.container.querySelector('input') as HTMLInputElement
    const button = view.container.querySelector('button[title*="搜索正文"]') as HTMLButtonElement
    await act(async () => {
      typeInto(input, '移码表示法')
    })
    await act(async () => {
      button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(mockQueryBook).toHaveBeenCalledTimes(1)
    expect(mockQueryBook).toHaveBeenCalledWith({
      kind: 'search',
      fingerprint: 'fp-1',
      keyword: '移码表示法',
      limit: 20,
    })
    await flush()
    expect(view.container.textContent).toContain('最多显示 20 条')
    expect(view.container.textContent).toContain('第2章')
    const item = view.container.querySelector('button.block') as HTMLButtonElement
    await act(async () => {
      item.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(view.onJumpToPage).toHaveBeenCalledWith(36)
    expect(view.container.textContent).not.toContain('最多显示 20 条')
    await view.unmount()
  })

  it('Enter 同样触发搜索', async () => {
    mockQueryBook.mockResolvedValue(searchOk([]))
    const view = await renderSearch({})
    const input = view.container.querySelector('input') as HTMLInputElement
    await act(async () => {
      typeInto(input, '补码加法器')
    })
    await act(async () => {
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(mockQueryBook).toHaveBeenCalledTimes(1)
    await flush()
    expect(view.container.textContent).toContain('未命中')
    await view.unmount()
  })

  it('未索引禁用入口并提示，不请求', async () => {
    const view = await renderSearch({ indexed: false })
    const input = view.container.querySelector('input') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(view.container.textContent).toContain('先建立罗盘索引')
    expect(mockQueryBook).not.toHaveBeenCalled()
    await view.unmount()
  })

  it('文件切换清空旧结果', async () => {
    mockQueryBook.mockResolvedValue(searchOk([hit()]))
    const view = await renderSearch({ fingerprint: 'fp-1' })
    const input = view.container.querySelector('input') as HTMLInputElement
    await act(async () => {
      typeInto(input, '移码表示法')
    })
    const button = view.container.querySelector('button[title*="搜索正文"]') as HTMLButtonElement
    await act(async () => {
      button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    await flush()
    expect(view.container.textContent).toContain('最多显示 20 条')
    await view.rerender('fp-2')
    expect((view.container.querySelector('input') as HTMLInputElement).value).toBe('')
    expect(view.container.textContent).not.toContain('最多显示 20 条')
    await view.unmount()
  })
})
