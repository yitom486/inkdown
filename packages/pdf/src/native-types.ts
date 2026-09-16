export type NativePdfType = 'TextBased' | 'Scanned' | 'ImageBased' | 'Mixed'

export interface NativePdfClassification {
  pdfType: NativePdfType
  pageCount: number
  /** 0-indexed 待 OCR 页（原生输出） */
  pagesNeedingOcr: readonly number[]
  confidence: number
}

export interface NativePageMarkdown {
  /** 0-indexed（原生输出） */
  page: number
  markdown?: string | null
}

export interface NativePagesExtraction {
  pages: readonly NativePageMarkdown[]
  pagesWithTables: readonly number[]
  pagesWithColumns: readonly number[]
  pagesNeedingOcr: readonly number[]
  isComplex: boolean
}
