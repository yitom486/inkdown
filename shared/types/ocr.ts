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
