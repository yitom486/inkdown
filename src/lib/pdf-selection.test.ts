import { describe, expect, it } from 'vitest'
import { normalizeClientRects } from './pdf-selection'

describe('normalizeClientRects', () => {
  it('将 client rect 转为相对页坐标', () => {
    const pageRect = { left: 100, top: 200, width: 400, height: 800 } as DOMRect
    const clientRects = [{ left: 120, top: 220, width: 80, height: 20 }] as unknown as DOMRectList

    expect(normalizeClientRects(clientRects, pageRect)).toEqual([
      { x: 0.05, y: 0.025, width: 0.2, height: 0.025 },
    ])
  })
})
