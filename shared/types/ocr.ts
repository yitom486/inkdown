/**
 * PDF OCR 缓存与组件状态。
 * 用 fileFingerprint 当缓存键（文件内容变了旧缓存自动失效），不要只用路径。
 */

/** 阅读器侧栏目录项（OCR 结果会映射成这套，与 EPUB 等共用） */
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

/** OCR 识别出的一条目录；printedPage 是印在纸上的页码 */
export interface OcrTocEntry {
  title: string
  printedPage: number
  level: number
}

export interface PdfOcrTocCache {
  fileFingerprint: string
  tocPageRange: [number, number]
  /** 印刷页码与 PDF 页索引的差 */
  pageOffset: number
  entries: OcrTocEntry[]
  units: ReaderTocUnit[]
  createdAt: string
  /** 提取器版本；读取时版本不符视为过期（旧水印条目等不再复活） */
  extractorVersion?: number
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
  /** 真实总页数（pdf.js 已知）：目录重组范围门用，不再为此解析一次 */
  pageCount: number
}

export interface GetPdfOcrTocPayload {
  fileFingerprint: string
}

export interface SavePdfOcrTocPayload {
  cache: PdfOcrTocCache
}

/** 页内像素框；与 OCR 引擎坐标系一致，划词要对齐阅读器缩放 */
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
  /**
   * 调用方视口的 PDF 点尺寸（inspector 几何归一化用，与覆盖层同族）。
   * 缺失时主进程拒绝（INVALID_ARGUMENT），调用方须从 pdfjs viewport 提供。
   */
  pageWidthPt: number
  pageHeightPt: number
}

export interface GetPdfOcrPagePayload {
  fileFingerprint: string
  page: number
}

export interface ListPdfOcrPagesPayload {
  fileFingerprint: string
}

/** 语言包/引擎是否就绪；用 phase 收窄，不要只用 runtimeReady */
export type OcrComponentPhase = 'not-ready' | 'downloading' | 'ready' | 'error'

export interface OcrComponentStatus {
  phase: OcrComponentPhase
  /** 0–100 */
  progress: number
  message?: string
  runtimeReady: boolean
  languages: string[]
  missingLanguages: string[]
}
