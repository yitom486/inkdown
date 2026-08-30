// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { findPdfMarksAtPoint, renderPdfMarkOverlays } from './pdf-reading-marks'
import type { PdfSelectionSnapshot } from './pdf-selection'
import type { ReadingMark } from '@shared/types/reading-mark'
import type { PageViewport } from 'pdfjs-dist'

const viewport = {
  width: 100,
  height: 100,
  convertToViewportPoint: (x: number, y: number) => [x, 100 - y],
} as PageViewport

function createLayer(): SVGSVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg')
}

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
    const layer = createLayer()
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

    renderPdfMarkOverlays(layer, marks, 1, 'dark', viewport)

    expect(layer.children).toHaveLength(1)
    expect(layer.firstElementChild?.getAttribute('class')).toBe('pdf-mark-note')
    expect(layer.firstElementChild?.getAttribute('data-theme')).toBe('dark')
  })

  it('批注用虚线细条，强制透明底', () => {
    const layer = createLayer()
    const mark = createMark({
      kind: 'note',
      note: '测试批注',
      color: 'yellow',
      anchor: {
        format: 'pdf',
        page: 1,
        rects: [{ x: 0, y: 0.1, width: 0.5, height: 0.05 }],
      },
    })

    renderPdfMarkOverlays(layer, [mark], 1, 'light', viewport)
    const overlay = layer.firstElementChild as SVGLineElement
    expect(overlay.getAttribute('class')).toBe('pdf-mark-note')
    expect(overlay.dataset.color).toBeUndefined()
    expect(overlay.getAttribute('stroke')).toBeTruthy()
    // 旧 rect 也会转换成沿底边的 SVG 虚线。
    expect(Number(overlay.getAttribute('y1'))).toBeGreaterThan(14)
  })

  it('高亮使用所选颜色的半透明底', () => {
    const layer = createLayer()
    const mark = createMark({
      kind: 'highlight',
      color: 'green',
      anchor: {
        format: 'pdf',
        page: 1,
        rects: [{ x: 0, y: 0, width: 0.1, height: 0.1 }],
      },
    })

    renderPdfMarkOverlays(layer, [mark], 1, 'light', viewport)
    const overlay = layer.firstElementChild as SVGPolygonElement
    expect(overlay.dataset.color).toBe('green')
    expect(overlay.dataset.markId).toBe('mark-1')
    expect(overlay.getAttribute('fill')).toContain('rgba')
  })

  it('重点附带批注时仍绘制底色，而不是退化为纯批注虚线', () => {
    const layer = createLayer()
    const mark = createMark({
      kind: 'highlight',
      note: '重点说明',
      color: 'blue',
      anchor: {
        format: 'pdf',
        page: 1,
        version: 2,
        quads: [{
          points: [
            { x: 10, y: 90 }, { x: 40, y: 90 }, { x: 40, y: 80 }, { x: 10, y: 80 },
          ],
        }],
      },
    })

    renderPdfMarkOverlays(layer, [mark], 1, 'dark', viewport)

    const overlay = layer.firstElementChild as SVGPolygonElement
    expect(overlay.tagName.toLowerCase()).toBe('polygon')
    expect(overlay.getAttribute('class')).toBe('pdf-mark-highlight')
    expect(overlay.dataset.color).toBe('blue')
  })

  it('按点击位置命中当前页高亮', () => {
    const page = document.createElement('div')
    page.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    const marks: ReadingMark[] = [
      createMark({
        kind: 'highlight',
        anchor: {
          format: 'pdf',
          page: 1,
          rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }],
        },
      }),
    ]
    expect(findPdfMarksAtPoint(marks, 1, 15, 15, page)).toHaveLength(1)
    expect(findPdfMarksAtPoint(marks, 1, 80, 80, page)).toHaveLength(0)
  })

  it('重复调用时先清空旧 overlay', () => {
    const layer = createLayer()
    const mark = createMark({
      kind: 'highlight',
      anchor: {
        format: 'pdf',
        page: 1,
        rects: [{ x: 0, y: 0, width: 0.1, height: 0.1 }],
      },
    })

    renderPdfMarkOverlays(layer, [mark], 1, 'light', viewport)
    expect(layer.children).toHaveLength(1)

    renderPdfMarkOverlays(layer, [], 1, 'light', viewport)
    expect(layer.children).toHaveLength(0)
  })

  it('V2 PDF Quad 通过 viewport 转换后绘制', () => {
    const layer = createLayer()
    const mark = createMark({
      kind: 'highlight',
      anchor: {
        format: 'pdf',
        page: 1,
        version: 2,
        quads: [{
          points: [
            { x: 10, y: 90 },
            { x: 40, y: 90 },
            { x: 40, y: 80 },
            { x: 10, y: 80 },
          ],
        }],
      },
    })

    renderPdfMarkOverlays(layer, [mark], 1, 'light', viewport)
    expect(layer.firstElementChild?.getAttribute('points')).toBe('10,10 40,10 40,20 10,20')
  })

  it('缩放后按新 viewport 重新投影 V2 PDF Quad', () => {
    const layer = createLayer()
    const scaledViewport = {
      width: 200,
      height: 200,
      convertToViewportPoint: (x: number, y: number) => [x * 2, 200 - y * 2],
    } as PageViewport
    const mark = createMark({
      kind: 'highlight',
      anchor: {
        format: 'pdf',
        page: 1,
        version: 2,
        quads: [{
          points: [
            { x: 10, y: 90 }, { x: 40, y: 90 }, { x: 40, y: 80 }, { x: 10, y: 80 },
          ],
        }],
      },
    })

    renderPdfMarkOverlays(layer, [mark], 1, 'light', scaledViewport)

    expect(layer.getAttribute('viewBox')).toBe('0 0 200 200')
    expect(layer.firstElementChild?.getAttribute('points')).toBe('20,20 80,20 80,40 20,40')
  })

  it('临时选区使用独立图形且不会参与持久标记命中', () => {
    const layer = createLayer()
    const selection: PdfSelectionSnapshot = {
      page: 1,
      text: '临时选区',
      rect: new DOMRect(10, 10, 30, 10),
      rects: [],
      toolbarX: 25,
      toolbarY: 10,
      quads: [{
        points: [
          { x: 10, y: 90 }, { x: 40, y: 90 }, { x: 40, y: 80 }, { x: 10, y: 80 },
        ],
      }],
    }

    renderPdfMarkOverlays(layer, [], 1, 'light', viewport, selection)

    const overlay = layer.firstElementChild as SVGPolygonElement
    expect(overlay.getAttribute('class')).toBe('pdf-mark-transient-selection')
    expect(overlay.dataset.markId).toBeUndefined()

    renderPdfMarkOverlays(layer, [], 1, 'light', viewport, null)
    expect(layer.children).toHaveLength(0)
  })

  it('使用 SVG 的实际图形命中 V2 标记', () => {
    const page = document.createElement('div')
    page.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100)
    const layer = createLayer()
    layer.classList.add('pdf-marks-layer')
    layer.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100)
    page.append(layer)
    const mark = createMark({
      kind: 'highlight',
      anchor: {
        format: 'pdf',
        page: 1,
        version: 2,
        quads: [{
          points: [
            { x: 10, y: 90 }, { x: 40, y: 90 }, { x: 40, y: 80 }, { x: 10, y: 80 },
          ],
        }],
      },
    })
    renderPdfMarkOverlays(layer, [mark], 1, 'light', viewport)

    expect(findPdfMarksAtPoint([mark], 1, 20, 15, page)).toEqual([mark])
    expect(findPdfMarksAtPoint([mark], 1, 80, 80, page)).toEqual([])
  })
})
