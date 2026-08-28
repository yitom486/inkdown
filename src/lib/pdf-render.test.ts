// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { RenderingCancelledException } from 'pdfjs-dist'
import {
  getPdfDevicePixelRatio,
  isPdfRenderCancelled,
  resolvePdfVisiblePageRange,
  shouldRenderPdfPage,
} from './pdf-render'

describe('isPdfRenderCancelled', () => {
  it('识别 RenderingCancelledException 实例', () => {
    expect(isPdfRenderCancelled(new RenderingCancelledException('cancelled', 0))).toBe(true)
  })

  it('识别同名 Error', () => {
    const error = new Error('Rendering cancelled, page 1')
    error.name = 'RenderingCancelledException'
    expect(isPdfRenderCancelled(error)).toBe(true)
  })

  it('识别 same canvas 并发冲突消息', () => {
    expect(
      isPdfRenderCancelled(
        new Error(
          'Cannot use the same canvas during multiple render() operations. Use different canvas or ensure previous operations were cancelled or completed.',
        ),
      ),
    ).toBe(true)
  })

  it('普通错误返回 false', () => {
    expect(isPdfRenderCancelled(new Error('PDF 损坏'))).toBe(false)
    expect(isPdfRenderCancelled(null)).toBe(false)
  })
})

describe('pdf continuous render window', () => {
  it('按 DPR 钳制清晰度倍率', () => {
    expect(getPdfDevicePixelRatio(1)).toBe(1)
    expect(getPdfDevicePixelRatio(2.5)).toBe(2.5)
    expect(getPdfDevicePixelRatio(4)).toBe(3)
    expect(getPdfDevicePixelRatio(0)).toBe(1)
  })

  it('计算邻近页预渲染窗口', () => {
    expect(resolvePdfVisiblePageRange(1, 518)).toEqual({ start: 1, end: 3 })
    expect(resolvePdfVisiblePageRange(43, 518)).toEqual({ start: 41, end: 45 })
    expect(resolvePdfVisiblePageRange(518, 518)).toEqual({ start: 516, end: 518 })
  })

  it('判断某页是否应渲染', () => {
    expect(shouldRenderPdfPage(43, 43, 518)).toBe(true)
    expect(shouldRenderPdfPage(45, 43, 518)).toBe(true)
    expect(shouldRenderPdfPage(46, 43, 518)).toBe(false)
  })
})
