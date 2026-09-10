// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PdfToolbarMoreMenu, resolvePdfIndexBadge } from './PdfToolbarMoreMenu'

;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  document.body.innerHTML = ''
})

describe('resolvePdfIndexBadge', () => {
  const base = {
    hasFingerprint: true,
    importRunning: false,
    indexed: false,
    tocStale: false,
    isScannedPdf: true,
  }
  it('无指纹隐藏；导入中优先进度', () => {
    expect(resolvePdfIndexBadge({ ...base, hasFingerprint: false })).toBe('hidden')
    expect(resolvePdfIndexBadge({ ...base, importRunning: true })).toBe('running')
  })
  it('未入库仅扫描版提示，其他格式隐藏', () => {
    expect(resolvePdfIndexBadge(base)).toBe('unindexed-scanned')
    expect(resolvePdfIndexBadge({ ...base, isScannedPdf: false })).toBe('hidden')
  })
  it('已入库按目录新鲜度区分', () => {
    expect(resolvePdfIndexBadge({ ...base, indexed: true })).toBe('ready')
    expect(resolvePdfIndexBadge({ ...base, indexed: true, tocStale: true })).toBe('stale')
  })
})

describe('PdfToolbarMoreMenu', () => {
  it('空菜单不渲染触发器', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(PdfToolbarMoreMenu, { items: [] }))
    })
    expect(container.querySelector('button')).toBeNull()
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('点击菜单项回调并禁用项不可点', async () => {
    const onFit = vi.fn()
    const onClear = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        createElement(PdfToolbarMoreMenu, {
          items: [
            { key: 'fit', label: '适合宽度', onSelect: onFit },
            { key: 'clear', label: '清除缓存', disabled: true, onSelect: onClear },
          ],
        }),
      )
    })
    const trigger = container.querySelector('button[aria-label="更多工具"]') as HTMLButtonElement
    // Radix 菜单靠 pointerdown（button===0）打开，普通 click 打不开
    await act(async () => {
      trigger.dispatchEvent(
        new window.PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
      await Promise.resolve()
    })
    const items = [...document.body.querySelectorAll('[role="menuitem"]')]
    expect(items.map((item) => item.textContent)).toEqual(['适合宽度', '清除缓存'])
    await act(async () => {
      ;(items[0] as HTMLElement).dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(onFit).toHaveBeenCalledTimes(1)
    await act(async () => {
      ;(items[1] as HTMLElement).dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })
    expect(onClear).not.toHaveBeenCalled()
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})
