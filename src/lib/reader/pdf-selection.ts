import type { PdfTextRect } from '@shared/types/reading-mark'

export interface PdfSelectionSnapshot {
  text: string
  rect: DOMRect
  /** 批注高亮用，相对 textLayer（或 root）的归一化坐标 */
  rects: PdfTextRect[]
  page: number
  toolbarX: number
  toolbarY: number
}

export function normalizeClientRects(
  clientRects: DOMRectList | DOMRect[],
  layerRect: DOMRect,
): PdfTextRect[] {
  const rects: PdfTextRect[] = []
  const items = 'length' in clientRects ? Array.from(clientRects) : [clientRects]

  for (const rect of items) {
    if (rect.width <= 0 || rect.height <= 0) continue
    rects.push({
      x: (rect.left - layerRect.left) / layerRect.width,
      y: (rect.top - layerRect.top) / layerRect.height,
      width: rect.width / layerRect.width,
      height: rect.height / layerRect.height,
    })
  }

  return rects
}

export function unionClientRects(clientRects: DOMRect[]): DOMRect {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity

  for (const rect of clientRects) {
    if (rect.width <= 0 || rect.height <= 0) continue
    left = Math.min(left, rect.left)
    top = Math.min(top, rect.top)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }

  if (!Number.isFinite(left)) {
    return new DOMRect(0, 0, 0, 0)
  }

  return new DOMRect(left, top, right - left, bottom - top)
}

function readRangeClientRects(range: Range): DOMRect[] {
  return Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
}

function resolveSelectionLayer(rootElement: HTMLElement): HTMLElement {
  const textLayer = rootElement.querySelector('.textLayer')
  return textLayer instanceof HTMLElement ? textLayer : rootElement
}

/** 读取当前原生 Selection，不清除选区高亮 */
export function readPdfSelection(
  rootElement: HTMLElement,
  pageNum: number,
): PdfSelectionSnapshot | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!rootElement.contains(range.commonAncestorContainer)) return null

  const text = selection.toString().trim()
  if (!text) return null

  const clientRects = readRangeClientRects(range)
  if (clientRects.length === 0) return null

  const layerElement = resolveSelectionLayer(rootElement)
  const layerRect = layerElement.getBoundingClientRect()
  const rects = normalizeClientRects(clientRects, layerRect)
  if (rects.length === 0) return null

  const rect = unionClientRects(clientRects)

  return {
    text,
    rect,
    rects,
    page: pageNum,
    toolbarX: rect.left + rect.width / 2,
    toolbarY: rect.top,
  }
}

export function getSelectionToolbarPosition(snapshot: PdfSelectionSnapshot): {
  x: number
  y: number
} {
  return { x: snapshot.toolbarX, y: snapshot.toolbarY }
}

export { copyTextToClipboard } from '@/lib/reader/epub-selection'
