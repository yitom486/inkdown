/**
 * 主进程 pdf-inspector 解析契约（分类 + 整档 Markdown）。
 * 页码对外一律 1-indexed；Markdown 页标记与 WASM 同格式（`<!-- Page N -->`），
 * 渲染端复用同一套按页切分。
 */
export type InspectorPdfType = 'TextBased' | 'Scanned' | 'ImageBased' | 'Mixed'

export interface ClassifyPdfDocumentPayload {
  filePath: string
}

export interface InspectorPdfClassification {
  pdfType: InspectorPdfType
  pageCount: number
  /** 1-indexed 待 OCR 页 */
  pagesNeedingOcr: number[]
  confidence: number
}

export interface ExtractPdfBookMarkdownPayload {
  filePath: string
}

export interface InspectorBookMarkdown {
  /** 按页标记拼接的整档 Markdown；全空表示无可用文字层 */
  markdown: string
  pageCount: number
  /** 1-indexed 检出表格的页 */
  pagesWithTables: number[]
}
