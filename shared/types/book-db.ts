/**
 * 罗盘索引（单书 SQLite）行类型。
 * 约定：books 按 fingerprint 幂等；chapters 只收录一级目录项；
 * blocks 以 (book_id, chapter_index, block_index) 恢复全文顺序。
 */

export type BookBlockType = 'heading' | 'paragraph' | 'table' | 'list'

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
}
