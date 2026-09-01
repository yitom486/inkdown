export interface ReaderTocUnit {
  label: string
  href: string
  level: number
}

export interface OcrTocEntry {
  title: string
  printedPage: number
  level: number
}

export interface PdfOcrTocCache {
  fileFingerprint: string
  tocPageRange: [number, number]
  pageOffset: number
  entries: OcrTocEntry[]
  units: ReaderTocUnit[]
  createdAt: string
}

export interface RecognizePdfTocPayload {
  filePath: string
  fileFingerprint: string
  fromPage: number
  toPage: number
  /** 不传则按 toPage 自动估算 */
  pageOffset?: number
}

export interface GetPdfOcrTocPayload {
  fileFingerprint: string
}

export interface SavePdfOcrTocPayload {
  cache: PdfOcrTocCache
}

export interface OcrPageBBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface OcrPageWord {
  text: string
  bbox: OcrPageBBox
}

export interface PdfOcrPageCache {
  fileFingerprint: string
  page: number
  /** PDF 用户空间页宽（scale=1 viewport） */
  pageWidth: number
  pageHeight: number
  ocrScale: number
  words: OcrPageWord[]
  createdAt: string
}

export interface RecognizePdfPagePayload {
  filePath: string
  fileFingerprint: string
  page: number
}

export interface GetPdfOcrPagePayload {
  fileFingerprint: string
  page: number
}

export interface ListPdfOcrPagesPayload {
  fileFingerprint: string
}
