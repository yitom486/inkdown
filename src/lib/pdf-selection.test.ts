// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  normalizeClientRects,
  readPdfSelection,
  unionClientRects,
} from './pdf-selection'

describe('normalizeClientRects', () => {
  it('将 client rect 转为相对 layer 坐标', () => {
    const layerRect = { left: 100, top: 200, width: 400, height: 800 } as DOMRect
    const clientRects = [{ left: 120, top: 220, width: 80, height: 20 }] as unknown as DOMRectList

    expect(normalizeClientRects(clientRects, layerRect)).toEqual([
      { x: 0.05, y: 0.025, width: 0.2, height: 0.025 },
    ])
  })
})

describe('unionClientRects', () => {
  it('合并多个 client rect', () => {
    const union = unionClientRects([
      new DOMRect(10, 10, 20, 12),
      new DOMRect(30, 10, 20, 12),
      new DOMRect(10, 30, 40, 12),
    ])
    expect(union.left).toBe(10)
    expect(union.top).toBe(10)
    expect(union.width).toBe(40)
    expect(union.height).toBe(32)
  })
})

describe('readPdfSelection', () => {
  it('读取原生选区且不清除高亮', () => {
    const page = document.createElement('div')
    const layer = document.createElement('div')
    layer.className = 'textLayer'
    layer.getBoundingClientRect = () => new DOMRect(0, 0, 200, 400)

    const span = document.createElement('span')
    span.textContent = '选中文字'
    layer.append(span)
    page.append(layer)
    document.body.append(page)

    const selection = document.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(span)
    selection.removeAllRanges()
    selection.addRange(range)

    range.getClientRects = () => [new DOMRect(10, 20, 60, 16)] as unknown as DOMRectList

    const snapshot = readPdfSelection(page, 3)
    expect(snapshot?.text).toBe('选中文字')
    expect(snapshot?.page).toBe(3)
    expect(selection.rangeCount).toBe(1)

    selection.removeAllRanges()
    page.remove()
  })
})
