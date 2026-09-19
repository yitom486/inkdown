// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DiagramModal } from './DiagramModal'
import type { DiagramPayload } from './tools/DiagramViewerCard'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('./tools/DiagramViewerCard', () => ({
  DiagramViewerCard: ({ diagram }: { diagram: DiagramPayload }) =>
    createElement('div', { 'data-testid': 'mock-diagram-viewer' }, diagram?.title),
}))

describe('DiagramModal', () => {
  let container: HTMLDivElement
  let root: Root

  const mockDiagram: DiagramPayload = {
    diagramId: 'diag-flow-1',
    diagramType: 'sequence',
    title: 'ACP 握手时序交互图谱',
    mermaidCode: 'sequenceDiagram\n  Client->>Server: initialize\n  Server-->>Client: result',
    summary: '握手协商流程',
  }

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

  it('renders null when isOpen is false or diagram is null', async () => {
    await act(async () => {
      root.render(
        createElement(DiagramModal, {
          isOpen: false,
          onClose: vi.fn(),
          diagram: mockDiagram,
        }),
      )
    })

    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders dialog header, zoom controls, and diagram viewer when open', async () => {
    const onClose = vi.fn()

    await act(async () => {
      root.render(
        createElement(DiagramModal, {
          isOpen: true,
          onClose,
          diagram: mockDiagram,
        }),
      )
    })

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(container.textContent).toContain('ACP 握手时序交互图谱')
    expect(container.textContent).toContain('sequence · diag-flow-1')
    expect(container.textContent).toContain('100%')
    expect(container.querySelector('[data-testid="mock-diagram-viewer"]')).not.toBeNull()
  })

  it('adjusts zoom level when zoom buttons are clicked', async () => {
    await act(async () => {
      root.render(
        createElement(DiagramModal, {
          isOpen: true,
          onClose: vi.fn(),
          diagram: mockDiagram,
        }),
      )
    })

    const zoomInBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('title') === '放大',
    )
    expect(zoomInBtn).toBeDefined()

    await act(async () => {
      zoomInBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('115%')

    const zoomOutBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('title') === '缩小',
    )
    expect(zoomOutBtn).toBeDefined()

    await act(async () => {
      zoomOutBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('100%')
  })

  it('triggers onClose when backdrop or close button is clicked', async () => {
    const onClose = vi.fn()

    await act(async () => {
      root.render(
        createElement(DiagramModal, {
          isOpen: true,
          onClose,
          diagram: mockDiagram,
        }),
      )
    })

    const closeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('title')?.includes('关闭弹窗'),
    )
    expect(closeBtn).toBeDefined()

    await act(async () => {
      closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape key press', async () => {
    const onClose = vi.fn()

    await act(async () => {
      root.render(
        createElement(DiagramModal, {
          isOpen: true,
          onClose,
          diagram: mockDiagram,
        }),
      )
    })

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(onClose).toHaveBeenCalled()
  })
})
