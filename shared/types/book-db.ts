/**
 * 罗盘索引（单书 SQLite）行类型。
 * 约定：books 按 fingerprint 幂等；chapters 只收录一级目录项；
 * blocks 以 (book_id, chapter_index, block_index) 恢复全文顺序。
 */

export type BookBlockType = 'heading' | 'paragraph' | 'table' | 'list'

/**
 * 块文本来源（P1.1，v4）：native=原生文字层直提，ocr=OCR 识别，
 * unknown=未知（v4 前旧库回填失败时的兜底，正常流程不应出现）。
 */
export type BookBlockSource = 'native' | 'ocr' | 'unknown'

export interface BookDbBlockBBox {
  /** PDF 点坐标，与 inspector span 同帧（左、下、宽、高，y-up） */
  x: number
  y: number
  width: number
  height: number
}

export interface BookDbBlockHit {
  id: number
  type: BookBlockType
  content: string
  pageNumber: number
  chapterIndex: number
  chapterTitle: string | null
  blockIndex: number
  /** FTS 高亮片段（无命中高亮时回退正文前 60 字） */
  snippet: string
  /** P1.1：块文本来源；旧库缺列时查询层回退 'unknown' */
  source: BookBlockSource
  /** P1.1：提取管线版本（ROSETTA_CLEAN_VERSION）；旧库缺列时回退 '' */
  extractVersion: string
}
