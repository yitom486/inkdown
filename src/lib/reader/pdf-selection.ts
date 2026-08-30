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
    // 过滤异常碎块（偶发 0 宽高比的幽灵框）
    if (rect.width < 0.5 || rect.height < 0.5) continue
    rects.push({
      x: (rect.left - layerRect.left) / layerRect.width,
      y: (rect.top - layerRect.top) / layerRect.height,
      width: rect.width / layerRect.width,
      height: rect.height / layerRect.height,
    })
  }

  return rects
}

/**
 * 将同一视觉行的碎矩形齐高、并横向合并。
 * PDF text layer 中英混排时 getClientRects 高度不一致，直接画会呈锯齿。
 */
export function coalescePdfLineRects(
  rects: PdfTextRect[],
  yToleranceRatio = 0.55,
  xGap = 0.012,
): PdfTextRect[] {
  if (rects.length <= 1) return rects.map((rect) => ({ ...rect }))

  const sorted = [...rects].sort(
    (a, b) => a.y + a.height / 2 - (b.y + b.height / 2) || a.x - b.x,
  )
  const groups: PdfTextRect[][] = []

  for (const rect of sorted) {
    const mid = rect.y + rect.height / 2
    const group = groups.find((items) => {
      const sample = items[0]!
      const sampleMid = sample.y + sample.height / 2
      const tol = Math.max(sample.height, rect.height) * yToleranceRatio
      return Math.abs(sampleMid - mid) <= tol
    })
    if (group) group.push(rect)
    else groups.push([rect])
  }

  const result: PdfTextRect[] = []
  for (const group of groups) {
    const top = Math.min(...group.map((item) => item.y))
    const bottom = Math.max(...group.map((item) => item.y + item.height))
    const height = Math.max(bottom - top, 0)
    const byX = [...group].sort((a, b) => a.x - b.x)

    for (const rect of byX) {
      const prev = result[result.length - 1]
      const sameLine =
        prev &&
        Math.abs(prev.y - top) < 1e-6 &&
        Math.abs(prev.height - height) < 1e-6
      if (sameLine && rect.x <= prev.x + prev.width + xGap) {
        const right = Math.max(prev.x + prev.width, rect.x + rect.width)
        prev.x = Math.min(prev.x, rect.x)
        prev.width = right - prev.x
      } else {
        result.push({ x: rect.x, y: top, width: rect.width, height })
      }
    }
  }

  return result
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
  return Array.from(range.getClientRects()).filter((rect) => rect.width > 0.5 && rect.height > 0.5)
}

function resolveSelectionLayer(rootElement: HTMLElement): HTMLElement {
  const textLayer = rootElement.querySelector('.textLayer')
  return textLayer instanceof HTMLElement ? textLayer : rootElement
}

/** 将 Range 的 client rects 规范为齐高的页面相对矩形 */
export function rectsFromPdfRange(range: Range, layerElement: HTMLElement): PdfTextRect[] {
  const clientRects = readRangeClientRects(range)
  if (clientRects.length === 0) return []
  const layerRect = layerElement.getBoundingClientRect()
  if (layerRect.width <= 0 || layerRect.height <= 0) return []
  return coalescePdfLineRects(normalizeClientRects(clientRects, layerRect))
}

/** 读取当前原生 Selection，不清除选区；rects 已按行齐高合并 */
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
  const rects = rectsFromPdfRange(range, layerElement)
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
