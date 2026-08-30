import type { PdfTextRect } from '@shared/types/reading-mark'
import type { ReadingMark } from '@shared/types/reading-mark'
import { applyHighlightSurface } from '@/lib/reader/reading-mark-colors'
import { coalescePdfLineRects } from '@/lib/reader/pdf-selection'

export function renderPdfMarkOverlays(
  layer: HTMLElement,
  marks: ReadingMark[],
  pageNum: number,
  theme: 'dark' | 'light',
): void {
  layer.replaceChildren()

  for (const mark of marks) {
    if (mark.anchor.format !== 'pdf') continue
    if (mark.anchor.page !== pageNum) continue
    if (mark.kind === 'bookmark' || !mark.anchor.rects?.length) continue

    const isNote = mark.kind === 'note'
    const className = isNote ? 'pdf-mark-note' : 'pdf-mark-highlight'
    const rects = coalescePdfLineRects(mark.anchor.rects)
    for (const rect of rects) {
      // 批注只画行底细条（虚线下划线），避免整块矩形看起来像重点底
      const paintRect = isNote ? underlineRect(rect) : rect
      layer.appendChild(
        createOverlayRect(
          paintRect,
          className,
          theme,
          mark.id,
          isNote ? undefined : mark.color,
        ),
      )
    }
  }
}

/** 将行矩形压成底部下划线带（归一化高度） */
function underlineRect(rect: PdfTextRect): PdfTextRect {
  const height = Math.min(Math.max(rect.height * 0.18, 0.0035), rect.height)
  return {
    x: rect.x,
    y: rect.y + rect.height - height,
    width: rect.width,
    height,
  }
}

function createOverlayRect(
  rect: PdfTextRect,
  className: string,
  theme: 'dark' | 'light',
  markId: string,
  color?: string,
): HTMLDivElement {
  const element = document.createElement('div')
  element.className = className
  element.dataset.theme = theme
  element.dataset.markId = markId
  element.style.left = `${rect.x * 100}%`
  element.style.top = `${rect.y * 100}%`
  element.style.width = `${rect.width * 100}%`
  element.style.height = `${rect.height * 100}%`
  if (className === 'pdf-mark-highlight') {
    applyHighlightSurface(element, color, theme)
  } else {
    // 清掉可能残留的 inline !important 黄底
    element.style.setProperty('background', 'transparent', 'important')
  }
  return element
}

function pointInRect(x: number, y: number, rect: PdfTextRect, padY = 0): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y - padY &&
    y <= rect.y + rect.height + padY
  )
}

export function findPdfMarksAtPoint(
  marks: ReadingMark[],
  pageNum: number,
  clientX: number,
  clientY: number,
  pageElement: HTMLElement,
): ReadingMark[] {
  const box = pageElement.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return []
  const x = (clientX - box.left) / box.width
  const y = (clientY - box.top) / box.height

  return marks.filter((mark) => {
    if (mark.anchor.format !== 'pdf' || mark.anchor.page !== pageNum) return false
    if (mark.kind === 'bookmark' || !mark.anchor.rects?.length) return false
    const rects = coalescePdfLineRects(mark.anchor.rects)
    const padY = mark.kind === 'note' ? 0.008 : 0
    return rects.some((rect) => pointInRect(x, y, rect, padY))
  })
}

/** 优先返回带批注文案的标记（hover 气泡） */
export function findPdfNoteMarkAtPoint(
  marks: ReadingMark[],
  pageNum: number,
  clientX: number,
  clientY: number,
  pageElement: HTMLElement,
): ReadingMark | null {
  const hits = findPdfMarksAtPoint(marks, pageNum, clientX, clientY, pageElement)
  return hits.find((mark) => Boolean(mark.note?.trim())) ?? null
}
