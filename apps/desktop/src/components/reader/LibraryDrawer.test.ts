// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LibraryDrawer } from './LibraryDrawer'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('LibraryDrawer', () => {
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

  const mockRecentFiles = ['/books/algorithm-design.epub', '/books/network-protocols.pdf']
  const mockRecentUrls = ['https://spec.modelcontextprotocol.io/specification/', 'https://agentprotocol.ai/']

  it('renders bookshelf and web documents when open', async () => {
    const onClose = vi.fn()
    const onSelectFile = vi.fn()
    const onOpenWebDoc = vi.fn()

    await act(async () => {
      root.render(
        createElement(LibraryDrawer, {
          isOpen: true,
          onClose,
          recentFiles: mockRecentFiles,
          activeFilePath: mockRecentFiles[0],
          onSelectFile,
          recentWebUrls: mockRecentUrls,
          onOpenWebDoc,
        })
      )
    })

    expect(container.textContent).toContain('馆藏书卷与在线文档')
    expect(container.textContent).toContain('algorithm-design.epub')
    expect(container.textContent).toContain('network-protocols.pdf')
    expect(container.textContent).toContain('https://spec.modelcontextprotocol.io/specification/')
  })

  it('triggers onSelectFile when a book item is clicked', async () => {
    const onClose = vi.fn()
    const onSelectFile = vi.fn()

    await act(async () => {
      root.render(
        createElement(LibraryDrawer, {
          isOpen: true,
          onClose,
          recentFiles: mockRecentFiles,
          onSelectFile,
        })
      )
    })

    const nameSpan = Array.from(container.querySelectorAll('span')).find((el) =>
      el.textContent?.trim() === 'network-protocols.pdf'
    )
    const bookItem = nameSpan?.closest('.cursor-pointer')
    expect(bookItem).toBeDefined()

    await act(async () => {
      bookItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onSelectFile).toHaveBeenCalledWith('/books/network-protocols.pdf')
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when isOpen is false', async () => {
    await act(async () => {
      root.render(
        createElement(LibraryDrawer, {
          isOpen: false,
          onClose: vi.fn(),
          recentFiles: mockRecentFiles,
          onSelectFile: vi.fn(),
        })
      )
    })

    expect(container.textContent).toBe('')
  })
})
