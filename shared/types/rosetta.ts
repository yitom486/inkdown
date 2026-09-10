import type { BookDbBlockHit } from './book-db'

/**
 * 罗盘索引 IPC 契约（扫描书一键导入 + 读库）。
 * 目录一律真实页帧（渲染进程已用 offset 换算好，主进程不再碰印刷页）。
 */

export interface RosettaTocEntryInput {
  title: string
  realPage: number
  level: number
}

export interface RosettaImportPayload {
  filePath: string
  fileFingerprint: string
  title: string
  format: string
  scale?: number
  /** 总页数（渲染端 pdf.js 已知，主进程不再为此全量解析一次）；分段规划用 */
  pageCount: number
  toc: RosettaTocEntryInput[]
}

export interface RosettaImportStats {
  bookId: number
  chapters: number
  blocks: number
  pages: number
  /** 路由进 OCR 引擎的页数（Auto 下仅扫描页；文字书为 0） */
  ocrPages: number
  /** 原生直提的页数 */
  nativePages: number
}

export type RosettaImportState = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

/** 导入阶段：单次全量 OCR 不可再分，running 期只有阶段粒度进度 */
export type RosettaImportPhase = 'preparing' | 'ocr' | 'import'

/** 进行中的导入快照（挂载/聚焦轮询，窗口重载不丢状态） */
export interface RosettaActiveImport {
  fingerprint: string
  donePages: number
  totalPages: number
  phase: RosettaImportPhase
}

export interface RosettaImportStatus {
  fingerprint: string
  state: RosettaImportState
  donePages: number
  totalPages: number
  phase?: RosettaImportPhase
  message?: string
}

export interface RosettaBookInfo {
  fingerprint: string
  bookId: number
  title: string
  chapters: number
  blocks: number
  pages: number
  pageCount: number
  cleanVersion: string
  /** 目录签名（v3+；缺省 '' 表示未重建）；渲染端据此判断是否显示“更新罗盘目录” */
  tocSignature: string
  /** toc_entries 行数（v3+；旧库为 0） */
  tocEntries: number
}

export interface RosettaChapterInfo {
  index: number
  title: string
  startPage: number
  endPage: number
}

/** 单条目录项（含全部层级；范围由 modulePageRange 语义算出） */
export interface RosettaTocInfo {
  tocIndex: number
  title: string
  level: number
  startPage: number
  endPage: number
}

export type RosettaQuery =
  | { kind: 'page'; fingerprint: string; page: number }
  | { kind: 'chapter'; fingerprint: string; chapterIndex: number }
  | { kind: 'chapters'; fingerprint: string }
  | { kind: 'search'; fingerprint: string; keyword: string; limit?: number }
  | { kind: 'context'; fingerprint: string; chapterIndex: number; blockIndex: number; radius?: number }
  | { kind: 'toc'; fingerprint: string; tocIndex: number }
  | { kind: 'tocEntries'; fingerprint: string }

export type RosettaQueryResult =
  | { kind: 'page' | 'chapter' | 'search' | 'context'; blocks: BookDbBlockHit[] }
  | { kind: 'chapters'; chapters: RosettaChapterInfo[] }
  | { kind: 'toc'; entry: RosettaTocInfo; blocks: BookDbBlockHit[] }
  | { kind: 'tocEntries'; tocEntries: RosettaTocInfo[] }

/** 纯本地目录重建请求：调用方传入已确认目录（真实页帧），不读 OCR 缓存、不调引擎 */
export interface RosettaTocRebuildPayload {
  fingerprint: string
  toc: RosettaTocEntryInput[]
}

export interface RosettaTocRebuildResult {
  bookId: number
  tocEntries: number
  chapters: number
  blocks: number
  completedPages: number[]
  tocSignature: string
}

/** 正文水印清洗只读预览请求：只传指纹，主进程只读库、不写库 */
export interface RosettaBodyWatermarkPreviewPayload {
  fingerprint: string
  /** 可选按页筛选样例（正整数）；不传返回全书前 20 条，统计始终全局 */
  samplePage?: number
}

/** 预览样例单条：正文前后文本已截断（主进程侧截断，最多展示用） */
export interface RosettaBodyWatermarkPreviewSample {
  id: number
  pageNumber: number
  action: 'delete' | 'update'
  reason: string
  before: string
  after?: string
}

/** 正文水印清洗只读预览结果：计数 + 样例（最多 20 条），不含任何写入副作用 */
export interface RosettaBodyWatermarkPreviewResult {
  fingerprint: string
  bookId: number
  totalPatches: number
  deleteCount: number
  updateCount: number
  /** 涉及页数（去重后） */
  pageCount: number
  /** 按 reason 精确聚合计数 */
  reasonCounts: Record<string, number>
  /** 最多 20 条样例（库顺序），文本已截断 */
  samples: RosettaBodyWatermarkPreviewSample[]
  /** 回传本次样例页筛（未传为 null），UI 据此标明“全书/第 N 页” */
  samplePage?: number | null
}
