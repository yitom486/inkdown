export type ReadingMarkKind = 'bookmark' | 'highlight' | 'note'

export type ReadingDocumentFormat = 'pdf' | 'epub' | 'mobi'

export interface PdfTextRect {
  /** 相对页宽比例 0–1 */
  x: number
  /** 相对页高比例 0–1 */
  y: number
  width: number
  height: number
}

export interface PdfReadingAnchor {
  format: 'pdf'
  page: number
  selectedText?: string
  rects?: PdfTextRect[]
}

export interface EpubReadingAnchor {
  format: 'epub'
  cfi: string
  cfiRange?: string
  href?: string
  selectedText?: string
}

export interface MobiReadingAnchor {
  format: 'mobi'
  chapterId: string
  selectedText?: string
  rects?: PdfTextRect[]
}

export type ReadingAnchor = PdfReadingAnchor | EpubReadingAnchor | MobiReadingAnchor

export interface ReadingMark {
  id: string
  filePath: string
  fileFingerprint: string
  kind: ReadingMarkKind
  anchor: ReadingAnchor
  label?: string
  note?: string
  excerpt?: string
  color?: string
  createdAt: number
  updatedAt: number
}

export interface CreateReadingMarkPayload {
  filePath: string
  fileFingerprint: string
  kind: ReadingMarkKind
  anchor: ReadingAnchor
  label?: string
  note?: string
  excerpt?: string
  color?: string
}

export interface UpdateReadingMarkPayload {
  id: string
  label?: string
  note?: string
  color?: string
}
