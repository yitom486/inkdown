import {
  getSelectionToolbarPosition,
  unionClientRects,
  type PdfSelectionSnapshot,
} from '@/lib/pdf-selection'
import { normalizeRectsInScrollDocument } from '@/lib/reader-mark-geometry'

export function readMobiSelection(doc: Document, win: Window): PdfSelectionSnapshot | null {
  const selection = win.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const body = doc.body
  if (!body || !body.contains(range.commonAncestorContainer)) return null

  const text = selection.toString().trim()
  if (!text) return null

  const clientRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  )
  if (clientRects.length === 0) return null

  const rects = normalizeRectsInScrollDocument(clientRects, doc, body)
  if (rects.length === 0) return null

  const unionRect = unionClientRects(clientRects)
  const toolbarPos = getSelectionToolbarPosition({
    text,
    rect: unionRect,
    rects,
    page: 0,
    toolbarX: unionRect.left + unionRect.width / 2,
    toolbarY: unionRect.top,
  })

  return {
    text,
    rect: unionRect,
    rects,
    page: 0,
    toolbarX: toolbarPos.x,
    toolbarY: toolbarPos.y,
  }
}
