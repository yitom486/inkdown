import { readFile } from 'node:fs/promises'
import { err, ok, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import {
  defaultPdfPageOffset,
  extractOcrTocFromText,
  ocrTocToReaderUnits,
} from '@shared/reader/ocr-toc-extractor'
import type { PdfOcrTocCache, RecognizePdfTocPayload } from '@shared/types/ocr'
import { DEFAULT_PDF_OCR_SCALE } from '@shared/types/ocr'
import { writePdfOcrTocCache } from './ocr-toc-cache'
import { ensureOcrComponent } from './ocr-component-manager'
import { getOcrWorker } from './ocr-worker'
import { recognizeImageWithBlocks } from './recognize-image'
import { ensureInspectorOcrRuntime } from './inspector-ocr-runtime'

async function loadPdfConverter() {
  const mod = await import('pdf-to-img')
  return mod.pdf
}

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
    // 过渡期回退：inspector 运行时缺失/失败时仍走 tesseract，保证目录链路不断
    console.warn('[ocr] inspector 目录识别失败，回退 tesseract', cause)
    return recognizePdfTocWithTesseract(payload)
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
    const textParts = ordered.map((page) => page.markdown ?? '')

    const entries = extractOcrTocFromText(textParts.join('\n'))
    if (entries.length === 0) {
      return err({
        code: 'OCR_TOC_EMPTY',
        message: '未从目录页识别到章节条目，请调整页码范围后重试',
      })
    }

    const tocPageRange: [number, number] = [fromPage, toPage]
    const resolvedOffset = pageOffset ?? defaultPdfPageOffset(tocPageRange)
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

/** 回退路径：tesseract（待 inspector 全量验证后删除） */
async function recognizePdfTocWithTesseract(
  payload: RecognizePdfTocPayload,
): Promise<Result<PdfOcrTocCache, AppError>> {
  const { filePath, fileFingerprint, fromPage, toPage, pageOffset } = payload
  const scale = payload.scale ?? DEFAULT_PDF_OCR_SCALE

  try {
    const component = await ensureOcrComponent()
    if (!component.ok) return component

    const data = await readFile(filePath)
    const pdf = await loadPdfConverter()
    const doc = await pdf(data, { scale })
    const worker = await getOcrWorker()

    let pageNum = 0
    const textParts: string[] = []

    for await (const image of doc) {
      pageNum += 1
      if (pageNum < fromPage) continue
      if (pageNum > toPage) break
      const { data: ocrData } = await recognizeImageWithBlocks(worker, image)
      textParts.push(ocrData.text)
    }

    const entries = extractOcrTocFromText(textParts.join('\n'))
    if (entries.length === 0) {
      return err({
        code: 'OCR_TOC_EMPTY',
        message: '未从目录页识别到章节条目，请调整页码范围后重试',
      })
    }

    const tocPageRange: [number, number] = [fromPage, toPage]
    const resolvedOffset = pageOffset ?? defaultPdfPageOffset(tocPageRange)
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
