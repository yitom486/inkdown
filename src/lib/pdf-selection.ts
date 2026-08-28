import type { PdfTextRect } from '@shared/types/reading-mark'

export interface PdfSelectionSnapshot {
  text: string
  rect: DOMRect
  rects: PdfTextRect[]
  page: number
}

export function normalizeClientRects(
  clientRects: DOMRectList | DOMRect[],
  pageRect: DOMRect,
): PdfTextRect[] {
  const rects: PdfTextRect[] = []
  const items = 'length' in clientRects ? Array.from(clientRects) : [clientRects]

  for (const rect of items) {
    if (rect.width <= 0 || rect.height <= 0) continue
    rects.push({
      x: (rect.left - pageRect.left) / pageRect.width,
      y: (rect.top - pageRect.top) / pageRect.height,
      width: rect.width / pageRect.width,
      height: rect.height / pageRect.height,
    })
  }

  return rects
}

export function readPdfSelection(pageElement: HTMLElement, pageNum: number): PdfSelectionSnapshot | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const text = selection.toString().trim()
  if (!text) return null

  const range = selection.getRangeAt(0)
  if (!pageElement.contains(range.commonAncestorContainer)) return null

  const pageRect = pageElement.getBoundingClientRect()
  const clientRects = range.getClientRects()
  if (clientRects.length === 0) return null

  const rects = normalizeClientRects(clientRects, pageRect)
  if (rects.length === 0) return null

  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity

  for (const rect of clientRects) {
    left = Math.min(left, rect.left)
    top = Math.min(top, rect.top)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }

  return {
    text,
    rect: new DOMRect(left, top, right - left, bottom - top),
    rects,
    page: pageNum,
  }
}

export { copyTextToClipboard } from '@/lib/epub-selection'
