// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { RenderingCancelledException } from 'pdfjs-dist'
import { isPdfRenderCancelled } from './pdf-render'

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
