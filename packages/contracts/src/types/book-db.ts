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

/**
 * PDF 页面本地坐标系中的轴对齐矩形。
 *
 * - 单位：PDF point（1/72 英寸）
 * - 原点：页面左下角；x 向右，y 向上
 * - x/y 是矩形左下角，不是浏览器常用的左上角
 * - page number、页面尺寸、crop box 与 rotation 由所属记录或 viewport 提供
 * - 当前用于块级 Inspector span 对齐，是近似块框，不是逐字符选区几何
 */
export interface PdfPointBBox {
  /** 矩形左下角的 x 坐标，单位为 PDF point */
  x: number
  /** 矩形左下角的 y 坐标，单位为 PDF point */
  y: number
  /** 矩形宽度，单位为 PDF point */
  width: number
  /** 矩形高度，单位为 PDF point */
  height: number
}

/** @deprecated 使用 PdfPointBBox；保留此别名以兼容已有调用方。 */
export type BookDbBlockBBox = PdfPointBBox

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
