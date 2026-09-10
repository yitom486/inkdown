import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { err, ok, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import { buildBookIndex } from '@shared/reader/book-index'
import { DEFAULT_PDF_OCR_SCALE } from '@shared/types/ocr'
import type {
  RosettaActiveImport,
  RosettaImportPayload,
  RosettaImportPhase,
  RosettaImportStats,
} from '@shared/types/rosetta'
import type { InspectorSpanLike } from '@shared/reader/ocr-page-words'
import { ensureInspectorOcrRuntime } from '../ocr/inspector-ocr-runtime'
import { openBookDb } from './open-book-db'
import {
  ensureImportBookRow,
  getCompletedPages,
  importBookChunk,
  markPagesCompleted,
} from './import-book'
import { countBookBlocks, countPagesWithBbox } from './queries'

/** 罗盘入库清洗管线版本；ocr-watermark 语义变更时同步 +1 */
export const ROSETTA_CLEAN_VERSION = 'ocr-watermark-v3'

type InspectorModule = typeof import('@firecrawl/pdf-inspector')

export interface RosettaImportDeps {
  loadInspector?: () => Promise<InspectorModule>
  ensureRuntime?: () => Promise<Result<{ modelDir: string }, AppError>>
  readPdf?: (filePath: string) => Promise<Buffer>
  /** 默认走 userData 落盘库；单测注入 :memory: 库 */
  openDb?: (fingerprint: string) => DatabaseSync
}

export interface RosettaImportHooks {
  onProgress?: (donePages: number, totalPages: number, phase: RosettaImportPhase) => void
  shouldCancel?: () => boolean
}

async function defaultLoadInspector(): Promise<InspectorModule> {
  return await import('@firecrawl/pdf-inspector')
}

// OCR 引擎 session 互斥串行：同一进程同时只允许一个导入任务
let activeFingerprint: string | null = null
let cancelRequested = false
let activeProgress: RosettaActiveImport | null = null

export function isRosettaImportActive(): boolean {
  return activeFingerprint !== null
}

/** 当前导入快照（挂载/聚焦时轮询，窗口重载不丢状态） */
export function getActiveRosettaImport(): RosettaActiveImport | null {
  return activeProgress
}

export function cancelRosettaImport(): void {
  cancelRequested = true
}

function cancelledError(donePages: number, totalPages: number): Result<never, AppError> {
  return err({
    code: 'CANCELLED',
    message: `已取消罗盘导入，已入库 ${donePages}/${totalPages} 页，下次继续`,
  })
}

/**
 * 扫描书一键导入：运行时 → 读文件 → 建库行 → 分块 OCR+入库（可续跑）。
 * 目录由调用方给真实页帧；非法页码条目丢弃。长任务，调用方用 hooks 接进度/取消。
 * 崩溃/取消后重进：已入库块按 completed_pages 跳过，只做剩余块。
 */
export async function importScannedBookToDb(
  userDataDir: string,
  payload: RosettaImportPayload,
  hooks?: RosettaImportHooks,
  deps?: RosettaImportDeps,
): Promise<Result<RosettaImportStats, AppError>> {
  const fingerprint = payload.fileFingerprint.trim()
  if (!fingerprint) {
    return err({ code: 'INVALID_ARGUMENT', message: '缺少文件指纹' })
  }
  if (activeFingerprint !== null) {
    return err({ code: 'INVALID_STATE', message: '已有罗盘导入在进行中，请等待完成或取消' })
  }
  activeFingerprint = fingerprint
  cancelRequested = false
  activeProgress = { fingerprint, donePages: 0, totalPages: 0, phase: 'preparing' }
  try {
    return await runImport(userDataDir, payload, fingerprint, hooks, deps)
  } finally {
    activeFingerprint = null
    cancelRequested = false
    activeProgress = null
  }
}

async function runImport(
  userDataDir: string,
  payload: RosettaImportPayload,
  fingerprint: string,
  hooks: RosettaImportHooks | undefined,
  deps: RosettaImportDeps | undefined,
): Promise<Result<RosettaImportStats, AppError>> {
  const ensureRuntime = deps?.ensureRuntime ?? ensureInspectorOcrRuntime
  const runtime = await ensureRuntime()
  if (!runtime.ok) {
    return err({ code: 'OCR_FAILED', message: runtime.error.message })
  }
  let data: Buffer
  try {
    data = await (deps?.readPdf ? deps.readPdf(payload.filePath) : readFile(payload.filePath))
  } catch {
    return err({ code: 'FILE_NOT_FOUND', message: 'PDF 文件不存在或无法读取' })
  }
  let mod: InspectorModule
  try {
    mod = await (deps?.loadInspector ? deps.loadInspector() : defaultLoadInspector())
  } catch (cause) {
    return err({
      code: 'OCR_FAILED',
      message: cause instanceof Error ? cause.message : 'OCR 引擎加载失败',
    })
  }

  const scale = payload.scale ?? DEFAULT_PDF_OCR_SCALE
  const dpi = Math.round(scale * 72)
  // classify 省掉：它本身就是一次全量解析（199MB 书 ≈ 数百 MB transient），
  // 页数由渲染端 pdf.js 直接给（同样准确），主进程不再为此解析一次。
  // 非法 PDF 的错误由 OCR 调用本身报出。
  //
  // 大块分段（不是分批）：fork 每次调用都会全量解析整个 PDF
  //（lib.rs load_document_from_mem，选页不减少加载量），17×20 的小分批 =
  // 全量解析 17 次，堆 churn 到 Rust 分配失败直接 abort 主进程。
  // 但全量解析成本只与文件大小有关、与选页数无关，所以块越少越好：
  // 上限 4 块、目标每块 85 页（340 页书 4 步、每步约 2 分钟），
  // 既有进度/取消粒度，又把解析次数压到个位数。管线内部另按 chunk 限流渲染。
  // 代价：块内不可中断，取消在块边界生效。
  const plannedTotal = payload.pageCount
  if (!Number.isInteger(plannedTotal) || plannedTotal < 1) {
    return err({ code: 'INVALID_ARGUMENT', message: '页数无效' })
  }
  const title = payload.title.trim() || basename(payload.filePath)
  const t0 = Date.now()
  const log = (message: string): void => {
    console.info(`[rosetta] ${message}`)
  }
  const track = (donePages: number, phase: RosettaImportPhase): void => {
    activeProgress = { fingerprint, donePages, totalPages: plannedTotal, phase }
    hooks?.onProgress?.(donePages, plannedTotal, phase)
  };
  log(`import start: ${title} ${plannedTotal}页`)
  const chunkCount = Math.min(4, Math.max(1, Math.ceil(plannedTotal / 85)))
  const chunkSize = Math.ceil(plannedTotal / chunkCount)

  const toc = payload.toc
    .filter((entry) => entry && Number.isInteger(entry.realPage) && entry.realPage >= 1 && entry.realPage <= plannedTotal)
    .map((entry) => ({ title: entry.title, realPage: entry.realPage, level: entry.level }))
  const index = buildBookIndex({
    pageCount: plannedTotal,
    pageOffset: 0,
    printedToc: toc,
    contents: [],
  })

  let db: DatabaseSync
  try {
    db = deps?.openDb ? deps.openDb(fingerprint) : openBookDb(userDataDir, fingerprint)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '罗盘库打开失败'
    log(`import failed: ${message}`)
    return err({ code: 'OCR_FAILED', message })
  }
  let bookId: number
  try {
    bookId = ensureImportBookRow(
      db,
      {
        fingerprint,
        title,
        sourcePath: payload.filePath,
        format: payload.format,
        pageCount: plannedTotal,
        pageOffset: 0,
        cleanVersion: ROSETTA_CLEAN_VERSION,
      },
      index,
    ).bookId
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '罗盘初始化失败'
    log(`import failed: ${message}`)
    return err({ code: 'OCR_FAILED', message })
  }

  const done = getCompletedPages(db, bookId)
  const isComplete = (): boolean => {
    for (let page = 1; page <= plannedTotal; page += 1) {
      if (!done.has(page)) return false
    }
    return true
  }
  if (isComplete()) {
    const chapters = index.toc.filter((entry) => entry.level <= 1).length
    const blocks = countBookBlocks(db, bookId)
    const ocrPages = countPagesWithBbox(db, bookId, Array.from(done))
    log(`import reuse: ${title} ${plannedTotal}页已入库，跳过`)
    track(plannedTotal, 'import')
    return ok({
      bookId,
      chapters,
      blocks,
      pages: plannedTotal,
      ocrPages,
      nativePages: plannedTotal - ocrPages,
    })
  }
  if (done.size > 0) log(`续跑：跳过已入库 ${done.size} 页`)
  track(done.size, 'ocr')

  if (hooks?.shouldCancel?.() || cancelRequested) {
    log(`import cancelled at ${done.size}/${plannedTotal}`)
    return cancelledError(done.size, plannedTotal)
  }
  const routedPages = new Set<number>()
  const skippedPages: number[] = []
  let chunkNo = 0
  const totalChunks = Math.ceil(plannedTotal / chunkSize)
  for (let start = 1; start <= plannedTotal; start += chunkSize) {
    const end = Math.min(plannedTotal, start + chunkSize - 1)
    const rangePages: number[] = []
    for (let page = start; page <= end; page += 1) rangePages.push(page)
    if (rangePages.every((page) => done.has(page))) {
      log(`skip chunk ${start}-${end}（已入库）`)
      skippedPages.push(...rangePages)
      track(end, 'ocr')
      continue
    }
    if (hooks?.shouldCancel?.() || cancelRequested) {
      log(`import cancelled at ${done.size}/${plannedTotal}`)
      return cancelledError(done.size, plannedTotal)
    }
    chunkNo += 1
    const chunkStart = Date.now()
    let chunk: {
      pages: { pageNumber: number; markdown?: string; spans?: InspectorSpanLike[] }[]
      pagesRoutedToOcr?: number[]
    }
    try {
      chunk = await mod.processPdfWithOcr(data, {
        mode: mod.OcrMode.Auto,
        pageNumbers: rangePages,
        dpi,
        modelDirectory: runtime.value.modelDir,
        offline: true,
        minimumConfidence: 0.3,
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : `第 ${start}-${end} 页识别失败`
      log(`import failed: ${message}`)
      return err({ code: 'OCR_FAILED', message })
    }
    const chunkPages = [...chunk.pages].sort((a, b) => a.pageNumber - b.pageNumber)
    const chunkSpans = new Map<number, InspectorSpanLike[]>()
    for (const page of chunkPages) {
      chunkSpans.set(page.pageNumber, page.spans ?? [])
    }
    let chunkBlocks = 0
    try {
      chunkBlocks = importBookChunk(
        db,
        {
          bookId,
          index,
          pages: chunkPages.map((page) => ({ page: page.pageNumber, markdown: page.markdown ?? '' })),
          spansByPage: chunkSpans,
          // P1.1：本轮路由集合决定来源；extract_version 记当前清洗管线版本
          ocrPages: new Set(
            (Array.isArray(chunk.pagesRoutedToOcr) ? chunk.pagesRoutedToOcr : []).filter(
              (page): page is number => Number.isInteger(page),
            ),
          ),
          extractVersion: ROSETTA_CLEAN_VERSION,
        },
      ).blocks
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : `第 ${start}-${end} 页入库失败`
      log(`import failed: ${message}`)
      return err({ code: 'OCR_FAILED', message })
    }
    const routed = Array.isArray(chunk.pagesRoutedToOcr) ? chunk.pagesRoutedToOcr : []
    for (const routedPage of routed) {
      if (Number.isInteger(routedPage)) routedPages.add(routedPage)
    }
    markPagesCompleted(db, bookId, rangePages)
    for (const page of rangePages) done.add(page)
    track(end, 'ocr')
    log(
      `chunk ${chunkNo}/${totalChunks} ${start}-${end} ${Date.now() - chunkStart}ms ` +
        `路由OCR ${routed.length}页 入库 ${chunkBlocks}块`,
    )
  }
  if (hooks?.shouldCancel?.() || cancelRequested) {
    log(`import cancelled at ${done.size}/${plannedTotal}`)
    return cancelledError(done.size, plannedTotal)
  }
  track(plannedTotal, 'import')
  // 跳过的块没经过本轮路由集合，用 bbox 回补它们的 OCR 计数
  const ocrPages = routedPages.size + countPagesWithBbox(db, bookId, skippedPages)
  const chapters = index.toc.filter((entry) => entry.level <= 1).length
  const blocks = countBookBlocks(db, bookId)
  log(
    `import done: ${title} ${chapters}章 ${blocks}块 ` +
      `原生${plannedTotal - ocrPages}/扫描${ocrPages} 总耗时${((Date.now() - t0) / 1000).toFixed(0)}s`,
  )
  return ok({
    bookId,
    chapters,
    blocks,
    pages: plannedTotal,
    ocrPages,
    nativePages: plannedTotal - ocrPages,
  })
}
