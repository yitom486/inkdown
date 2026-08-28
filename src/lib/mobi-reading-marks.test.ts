// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { clearMobiMarkOverlays, renderMobiMarkOverlays } from './mobi-reading-marks'
import type { ReadingMark } from '@shared/types/reading-mark'

function createMark(overrides: Partial<ReadingMark> & Pick<ReadingMark, 'kind' | 'anchor'>): ReadingMark {
  return {
    id: 'mark-1',
    filePath: 'D:\\books\\demo.mobi',
    fileFingerprint: 'fp',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('renderMobiMarkOverlays', () => {
  it('仅渲染当前章节的高亮与批注 overlay', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>chapter body</p>'

    const marks: ReadingMark[] = [
      createMark({
        kind: 'highlight',
        anchor: {
          format: 'mobi',
          chapterId: 'ch-2',
          rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
        },
      }),
      createMark({
        kind: 'note',
        anchor: {
          format: 'mobi',
          chapterId: 'ch-1',
          rects: [{ x: 0.05, y: 0.1, width: 0.2, height: 0.03 }],
        },
      }),
      createMark({
        kind: 'bookmark',
        anchor: { format: 'mobi', chapterId: 'ch-1' },
      }),
    ]

    renderMobiMarkOverlays(container, marks, 'ch-1', 'dark')

    const overlays = container.querySelectorAll('.mobi-mark-highlight, .mobi-mark-note')
    expect(overlays).toHaveLength(1)
    expect(overlays[0]?.className).toBe('mobi-mark-note')
    expect(overlays[0]?.getAttribute('data-theme')).toBe('dark')
    expect(container.querySelector('p')?.textContent).toBe('chapter body')
  })

  it('重复调用时移除旧 overlay 且保留章节 HTML', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>keep me</p>'

    const mark = createMark({
      kind: 'highlight',
      anchor: {
        format: 'mobi',
        chapterId: 'ch-1',
        rects: [{ x: 0, y: 0, width: 0.1, height: 0.1 }],
      },
    })

    renderMobiMarkOverlays(container, [mark], 'ch-1', 'light')
    expect(container.querySelectorAll('.mobi-mark-highlight')).toHaveLength(1)

    renderMobiMarkOverlays(container, [], 'ch-1', 'light')
    expect(container.querySelectorAll('.mobi-mark-highlight, .mobi-mark-note')).toHaveLength(0)
    expect(container.querySelector('p')?.textContent).toBe('keep me')
  })
})

describe('clearMobiMarkOverlays', () => {
  it('只移除标记 overlay', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>text</p><div class="mobi-mark-highlight"></div>'

    clearMobiMarkOverlays(container)

    expect(container.querySelector('.mobi-mark-highlight')).toBeNull()
    expect(container.querySelector('p')).not.toBeNull()
  })
})
