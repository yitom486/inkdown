// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BracketConnector } from './BracketConnector'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('BracketConnector', () => {
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

  it('renders single-line connecting SVG when collapsed', async () => {
    await act(async () => {
      root.render(createElement(BracketConnector, { isCollapsed: true, isActive: false }))
    })

    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 36 16')
    expect(container.querySelectorAll('line').length).toBe(1)
    expect(container.querySelectorAll('circle').length).toBe(2)
  })

  it('renders bracket branch paths and multiple end points when expanded', async () => {
    await act(async () => {
      root.render(createElement(BracketConnector, { isCollapsed: false, isActive: false }))
    })

    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 36 100')
    // 2 paths for upper and lower curve brackets
    expect(container.querySelectorAll('path').length).toBe(2)
    // 4 circles (1 origin + 3 bracket tips)
    expect(container.querySelectorAll('circle').length).toBe(4)
  })

  it('applies active highlight style when isActive is true', async () => {
    await act(async () => {
      root.render(createElement(BracketConnector, { isCollapsed: false, isActive: true }))
    })

    const group = container.querySelector('g')
    expect(group).not.toBeNull()
    expect(group?.getAttribute('stroke')).toBe('var(--primary)')
    expect(group?.getAttribute('stroke-opacity')).toBe('0.95')
  })
})
