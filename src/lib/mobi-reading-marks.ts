import type { PdfTextRect, ReadingMark } from '@shared/types/reading-mark'

const MOBI_MARK_SELECTOR = '.mobi-mark-highlight, .mobi-mark-note'

export function clearMobiMarkOverlays(container: HTMLElement): void {
  container.querySelectorAll(MOBI_MARK_SELECTOR).forEach((node) => {
    node.remove()
  })
}

export function renderMobiMarkOverlays(
  container: HTMLElement,
  marks: ReadingMark[],
  chapterId: string,
  theme: 'dark' | 'light',
): void {
  clearMobiMarkOverlays(container)

  for (const mark of marks) {
    if (mark.anchor.format !== 'mobi') continue
    if (mark.anchor.chapterId !== chapterId) continue
    if (mark.kind === 'bookmark' || !mark.anchor.rects?.length) continue

    const className = mark.kind === 'note' ? 'mobi-mark-note' : 'mobi-mark-highlight'
    for (const rect of mark.anchor.rects) {
      container.appendChild(createMobiOverlayRect(rect, className, theme))
    }
  }
}

function createMobiOverlayRect(
  rect: PdfTextRect,
  className: string,
  theme: 'dark' | 'light',
): HTMLDivElement {
  const element = document.createElement('div')
  element.className = className
  element.dataset.theme = theme
  element.style.position = 'absolute'
  element.style.left = `${rect.x * 100}%`
  element.style.top = `${rect.y * 100}%`
  element.style.width = `${rect.width * 100}%`
  element.style.height = `${rect.height * 100}%`
  element.style.pointerEvents = 'none'
  return element
}
