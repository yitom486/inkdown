export type ReadingMarkKind = 'bookmark' | 'highlight' | 'note'

export type ReadingDocumentFormat = 'pdf' | 'epub' | 'mobi' | 'web'

export interface PdfTextRect {
  /** 相对页宽比例 0–1 */
  x: number
  /** 相对页高比例 0–1 */
  y: number
  width: number
  height: number
}

export interface PdfPoint {
  x: number
  y: number
}

/** PDF 页面坐标中的文字四边形；points 顺序为左上、右上、右下、左下。 */
export interface PdfTextQuad {
  points: [PdfPoint, PdfPoint, PdfPoint, PdfPoint]
  /** 纯批注虚线使用的文字基线。 */
  baseline?: [PdfPoint, PdfPoint]
}

/** 对应 getTextContent().items 中的文字 item，而不是 textLayer DOM span。 */
export interface PdfTextPosition {
  itemIndex: number
  offset: number
}

export interface PdfTextQuote {
  exact: string
  prefix?: string
  suffix?: string
}

export interface PdfReadingAnchor {
  format: 'pdf'
  page: number
  selectedText?: string
  /** V2 使用 PDF 坐标 Quad + 语义位置；缺省表示旧版 rect 锚点。 */
  version?: 2
  begin?: PdfTextPosition
  end?: PdfTextPosition
  quote?: PdfTextQuote
  quads?: PdfTextQuad[]
  /** V1 兼容字段；新锚点只把它作为降级数据。 */
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

export interface WebReadingAnchor {
  format: 'web'
  /** 页 URL（规范化，无 hash） */
  url: string
  headingId?: string
  selectedText?: string
  quote?: PdfTextQuote
  rects?: PdfTextRect[]
}

export type ReadingAnchor = PdfReadingAnchor | EpubReadingAnchor | MobiReadingAnchor | WebReadingAnchor

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
  kind?: ReadingMarkKind
  label?: string
  note?: string
  color?: string
}
