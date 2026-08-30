import type { PdfTextRect } from '@shared/types/reading-mark'
import type { ReadingMark } from '@shared/types/reading-mark'
import { applyHighlightSurface } from '@/lib/reader/reading-mark-colors'

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

    const className = mark.kind === 'note' ? 'pdf-mark-note' : 'pdf-mark-highlight'
    for (const rect of mark.anchor.rects) {
      layer.appendChild(
        createOverlayRect(rect, className, theme, mark.id, mark.color),
      )
    }
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
  applyHighlightSurface(element, color, theme)
  return element
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
    return mark.anchor.rects.some(
      (rect) =>
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height,
    )
  })
}
