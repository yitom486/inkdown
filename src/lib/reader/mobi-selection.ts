import {
  getSelectionToolbarPosition,
  unionClientRects,
  type PdfSelectionSnapshot,
} from '@/lib/reader/pdf-selection'
import { normalizeRectsInScrollDocument } from '@/lib/reader/reader-mark-geometry'

export function readMobiSelection(doc: Document, win: Window): PdfSelectionSnapshot | null {
  const selection = win.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  return buildMobiSnapshotFromRange(doc, selection.getRangeAt(0), selection.toString().trim())
}

/** 由 DOM Range 构建选区快照（Agent 按摘录定位时用）。 */
export function buildMobiSnapshotFromRange(
  doc: Document,
  range: Range,
  text?: string,
): PdfSelectionSnapshot | null {
  const body = doc.body
  if (!body || !body.contains(range.commonAncestorContainer)) return null

  const resolvedText = (text ?? range.toString()).trim()
  if (!resolvedText) return null

  const clientRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  )
  if (clientRects.length === 0) return null

  const rects = normalizeRectsInScrollDocument(clientRects, doc, body)
  if (rects.length === 0) return null

  const unionRect = unionClientRects(clientRects)
  const toolbarPos = getSelectionToolbarPosition({
    text: resolvedText,
    rect: unionRect,
    rects,
    page: 0,
    toolbarX: unionRect.left + unionRect.width / 2,
    toolbarY: unionRect.top,
  })

  return {
    text: resolvedText,
    rect: unionRect,
    rects,
    page: 0,
    toolbarX: toolbarPos.x,
    toolbarY: toolbarPos.y,
  }
}
