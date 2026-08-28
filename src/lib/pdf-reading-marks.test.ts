// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { renderPdfMarkOverlays } from './pdf-reading-marks'
import type { ReadingMark } from '@shared/types/reading-mark'

function createMark(overrides: Partial<ReadingMark> & Pick<ReadingMark, 'kind' | 'anchor'>): ReadingMark {
  return {
    id: 'mark-1',
    filePath: 'D:\\books\\demo.pdf',
    fileFingerprint: 'fp',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('renderPdfMarkOverlays', () => {
  it('仅渲染当前页的高亮与批注 overlay', () => {
    const layer = document.createElement('div')
    const marks: ReadingMark[] = [
      createMark({
        kind: 'highlight',
        anchor: {
          format: 'pdf',
          page: 2,
          rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
        },
      }),
      createMark({
        kind: 'note',
        anchor: {
          format: 'pdf',
          page: 1,
          rects: [{ x: 0.05, y: 0.1, width: 0.2, height: 0.03 }],
        },
      }),
      createMark({
        kind: 'bookmark',
        anchor: { format: 'pdf', page: 1 },
      }),
    ]

    renderPdfMarkOverlays(layer, marks, 1, 'dark')

    expect(layer.children).toHaveLength(1)
    expect(layer.firstElementChild?.className).toBe('pdf-mark-note')
    expect(layer.firstElementChild?.getAttribute('data-theme')).toBe('dark')
  })

  it('重复调用时先清空旧 overlay', () => {
    const layer = document.createElement('div')
    const mark = createMark({
      kind: 'highlight',
      anchor: {
        format: 'pdf',
        page: 1,
        rects: [{ x: 0, y: 0, width: 0.1, height: 0.1 }],
      },
    })

    renderPdfMarkOverlays(layer, [mark], 1, 'light')
    expect(layer.children).toHaveLength(1)

    renderPdfMarkOverlays(layer, [], 1, 'light')
    expect(layer.children).toHaveLength(0)
  })
})
