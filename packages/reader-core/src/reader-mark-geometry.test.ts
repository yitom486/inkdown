// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { buildMobiMarkStylesCss, getMarkLayerMetrics, normalizeRectsInScrollDocument } from './reader-mark-geometry'

describe('normalizeRectsInScrollDocument', () => {
  it('按 contentRoot 尺寸归一化，避免 html/body scrollHeight 不一致导致错位', () => {
    const html = document.documentElement
    const body = document.body
    body.style.position = 'relative'
    body.style.height = '500px'
    body.style.width = '600px'
    body.innerHTML = '<p id="target">selected text</p>'

    Object.defineProperty(html, 'scrollHeight', { configurable: true, value: 900 })
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 500 })
    Object.defineProperty(body, 'offsetHeight', { configurable: true, value: 500 })
    Object.defineProperty(body, 'clientWidth', { configurable: true, value: 600 })

    body.getBoundingClientRect = () =>
      ({
        left: 40,
        top: 80,
        right: 640,
        bottom: 580,
        width: 600,
        height: 500,
        x: 40,
        y: 80,
        toJSON: () => ({}),
      }) as DOMRect

    const selectionRect = {
      left: 60,
      top: 180,
      right: 260,
      bottom: 200,
      width: 200,
      height: 20,
      x: 60,
      y: 180,
      toJSON: () => ({}),
    } as DOMRect

    const [rect] = normalizeRectsInScrollDocument([selectionRect], document, body)
    expect(rect).toMatchObject({
      x: (60 - 40) / 600,
      y: (180 - 80) / 500,
      width: 200 / 600,
      height: 20 / 500,
    })
    expect(getMarkLayerMetrics(body).height).toBe(500)
  })
})

describe('buildMobiMarkStylesCss', () => {
  it('批注 span 使用 text-decoration 下划线，避免 border 遮挡文字', () => {
    const css = buildMobiMarkStylesCss('light')
    expect(css).toContain('span.mobi-mark-note')
    expect(css).toContain('text-decoration-line: underline')
    expect(css).toContain('text-underline-offset')
    expect(css).toContain('border-bottom: none')
  })

  it('rect 回退批注使用独立 hit 区与 ::after 下划线', () => {
    const css = buildMobiMarkStylesCss('dark')
    expect(css).toContain('.mobi-mark-note-hit')
    expect(css).toContain('.mobi-mark-note-hit::after')
    expect(css).toContain('border-bottom: 2px dashed')
    expect(css).toContain('rgba(253, 224, 71')
    expect(css).toContain('::selection')
  })
})
