import type { PdfTextRect } from '@shared/types/reading-mark'
import type { ReadingMark } from '@shared/types/reading-mark'

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
      layer.appendChild(createOverlayRect(rect, className, theme))
    }
  }
}

function createOverlayRect(
  rect: PdfTextRect,
  className: string,
  theme: 'dark' | 'light',
): HTMLDivElement {
  const element = document.createElement('div')
  element.className = className
  element.dataset.theme = theme
  element.style.left = `${rect.x * 100}%`
  element.style.top = `${rect.y * 100}%`
  element.style.width = `${rect.width * 100}%`
  element.style.height = `${rect.height * 100}%`
  return element
}
