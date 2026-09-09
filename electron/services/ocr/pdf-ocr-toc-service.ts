import { readFile } from 'node:fs/promises'
import { err, ok, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import {
  defaultPdfPageOffset,
  extractOcrTocFromText,
  ocrTocToReaderUnits,
} from '@shared/reader/ocr-toc-extractor'
import { cleanOcrWatermarks } from '@shared/reader/ocr-watermark'
import type { PdfOcrTocCache, RecognizePdfTocPayload } from '@shared/types/ocr'
import { DEFAULT_PDF_OCR_SCALE } from '@shared/types/ocr'
import { writePdfOcrTocCache } from './ocr-toc-cache'
import { ensureInspectorOcrRuntime } from './inspector-ocr-runtime'

async function loadPdfInspector() {
  return await import('@firecrawl/pdf-inspector')
}

export async function recognizePdfToc(
  payload: RecognizePdfTocPayload,
): Promise<Result<PdfOcrTocCache, AppError>> {
  const { fromPage, toPage } = payload
  if (fromPage < 1 || toPage < fromPage) {
    return err({ code: 'INVALID_ARGUMENT', message: '目录页范围无效' })
  }

  try {
    return await recognizePdfTocWithInspector(payload)
  } catch (cause) {
    return err({
      code: 'OCR_FAILED',
      message: cause instanceof Error ? cause.message : '目录识别失败',
    })
  }
}

/** 主路径：pdf-inspector 整范围选择性 OCR，文本进同一套启发式解析 */
async function recognizePdfTocWithInspector(
  payload: RecognizePdfTocPayload,
): Promise<Result<PdfOcrTocCache, AppError>> {
  const { filePath, fileFingerprint, fromPage, toPage, pageOffset } = payload
  const scale = payload.scale ?? DEFAULT_PDF_OCR_SCALE

  const runtime = await ensureInspectorOcrRuntime()
  if (!runtime.ok) {
    throw new Error(runtime.error.message)
  }

  try {
    const data = await readFile(filePath)
    const mod = await loadPdfInspector()
    const pageNumbers: number[] = []
    for (let page = fromPage; page <= toPage; page += 1) pageNumbers.push(page)
    const result = await mod.processPdfWithOcr(data, {
      mode: mod.OcrMode.Auto,
      pageNumbers,
      dpi: Math.round(scale * 72),
      modelDirectory: runtime.value.modelDir,
      offline: true,
      minimumConfidence: 0.3,
    })
    const ordered = [...result.pages].sort((a, b) => a.pageNumber - b.pageNumber)
    // 水印/页眉先清洗再解析，避免“王道计”这类跨页重复行污染目录条目；
    // 清洗永不删除表格行，目录页表格不受影响
    const cleaned = cleanOcrWatermarks(
      ordered.map((page) => ({
        page: page.pageNumber,
        markdown: page.markdown ?? '',
        spans: page.spans ?? [],
      })),
    )
    const textParts = cleaned.pages.map((page) => page.markdown)

    const tocPageRange: [number, number] = [fromPage, toPage]
    const resolvedOffset = pageOffset ?? defaultPdfPageOffset(tocPageRange)
    // 先重组（竖线拆分/数字汤配对/范围门）再提取：页数由调用方给，不再解析一次；
    // 页数非法（IPC 越界/NaN 落成 null）则退化 legacy，不断整条链路
    const rawPageCount: unknown = payload.pageCount
    const pageCount =
      typeof rawPageCount === 'number' && Number.isInteger(rawPageCount) && rawPageCount > 0
        ? rawPageCount
        : undefined
    const entries = extractOcrTocFromText(
      textParts.join('\n'),
      pageCount === undefined ? undefined : { pageCount, pageOffset: resolvedOffset },
    )
    if (entries.length === 0) {
      return err({
        code: 'OCR_TOC_EMPTY',
        message: '未从目录页识别到章节条目，请调整页码范围后重试',
      })
    }

    const units = ocrTocToReaderUnits(entries, resolvedOffset)

    const cache: PdfOcrTocCache = {
      fileFingerprint,
      tocPageRange,
      pageOffset: resolvedOffset,
      entries: entries.map(({ title, printedPage, level }) => ({ title, printedPage, level })),
      units,
      createdAt: new Date().toISOString(),
    }

    await writePdfOcrTocCache(cache)
    return ok(cache)
  } catch (cause) {
    return err({
      code: 'OCR_FAILED',
      message: cause instanceof Error ? cause.message : '目录识别失败',
    })
  }
}
