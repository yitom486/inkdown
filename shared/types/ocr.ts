export interface ReaderTocUnit {
  label: string
  href: string
  level: number
}

export const PDF_OCR_SCALE_OPTIONS = [1.5, 2, 2.5] as const
export type PdfOcrScale = (typeof PDF_OCR_SCALE_OPTIONS)[number]
export const DEFAULT_PDF_OCR_SCALE: PdfOcrScale = 2

export const PDF_OCR_SCALE_OPTION_LABELS: Array<{ value: PdfOcrScale; label: string }> = [
  { value: 1.5, label: '快速' },
  { value: 2, label: '标准' },
  { value: 2.5, label: '清晰' },
]

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
  /** 渲染倍率，越高越清晰但更慢 */
  scale?: PdfOcrScale
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
  scale?: PdfOcrScale
}

export interface GetPdfOcrPagePayload {
  fileFingerprint: string
  page: number
}

export interface ListPdfOcrPagesPayload {
  fileFingerprint: string
}

export type OcrComponentPhase = 'not-ready' | 'downloading' | 'ready' | 'error'

export interface OcrComponentStatus {
  phase: OcrComponentPhase
  /** 0–100 */
  progress: number
  message?: string
  languages: string[]
  missingLanguages: string[]
}
