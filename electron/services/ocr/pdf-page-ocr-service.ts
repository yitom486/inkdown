import { readFile } from 'node:fs/promises'
import { err, ok, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import { normalizeInspectorSpans, normalizeOcrWords } from '@shared/reader/ocr-page-words'
import type { PdfOcrPageCache, PdfOcrScale, RecognizePdfPagePayload } from '@shared/types/ocr'
import { DEFAULT_PDF_OCR_SCALE } from '@shared/types/ocr'
import { writePdfOcrPageCache } from './ocr-page-cache'
import { ensureOcrComponent } from './ocr-component-manager'
import { getOcrWorker } from './ocr-worker'
import { extractTesseractWords } from './tesseract-words'
import { recognizeImageWithBlocks } from './recognize-image'
import { ensureInspectorOcrRuntime } from './inspector-ocr-runtime'

const OCR_SCALE = DEFAULT_PDF_OCR_SCALE
/** inspector OCR 置信度门限（0–1；与词过滤 floor 对齐） */
const INSPECTOR_MIN_CONFIDENCE = 0.3

async function loadPdfConverter() {
  const mod = await import('pdf-to-img')
  return mod.pdf
}

async function loadPdfInspector() {
  return await import('@firecrawl/pdf-inspector')
}

function readPngSize(image: Buffer): { width: number; height: number } {
  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  }
}

async function renderPdfPageImage(
  filePath: string,
  pageNumber: number,
  scale: PdfOcrScale = OCR_SCALE,
): Promise<{ image: Buffer; width: number; height: number }> {
  const data = await readFile(filePath)
  const pdf = await loadPdfConverter()
  const doc = await pdf(data, { scale })
  let current = 0
  for await (const image of doc) {
    current += 1
    if (current === pageNumber) {
      const buffer = Buffer.from(image)
      const { width, height } = readPngSize(buffer)
      return { image: buffer, width, height }
    }
    if (current > pageNumber) break
  }
  throw new Error(`PDF 页码超出范围：${pageNumber}`)
}

export async function recognizePdfPage(
  payload: RecognizePdfPagePayload,
): Promise<Result<PdfOcrPageCache, AppError>> {
  const { fileFingerprint, page } = payload
  if (page < 1) {
    return err({ code: 'INVALID_ARGUMENT', message: '页码无效' })
  }

  try {
    return await recognizePdfPageWithInspector(payload)
  } catch (cause) {
    // 过渡期回退：inspector 运行时缺失/失败时仍走 tesseract，保证扫描链路不断
    console.warn('[ocr] inspector 单页识别失败，回退 tesseract', cause)
    return recognizePdfPageWithTesseract(payload)
  }
}

/** 主路径：pdf-inspector 选择性 OCR（自带阅读顺序与表格，几何进缓存） */
async function recognizePdfPageWithInspector(
  payload: RecognizePdfPagePayload,
): Promise<Result<PdfOcrPageCache, AppError>> {
  const { filePath, fileFingerprint, page, pageWidthPt, pageHeightPt } = payload
  const scale = payload.scale ?? OCR_SCALE
  if (!(pageWidthPt > 0) || !(pageHeightPt > 0)) {
    return err({ code: 'INVALID_ARGUMENT', message: '缺少页面尺寸，无法归一化坐标' })
  }

  const runtime = await ensureInspectorOcrRuntime()
  if (!runtime.ok) {
    throw new Error(runtime.error.message)
  }

  const data = await readFile(filePath)
  const mod = await loadPdfInspector()
  const result = await mod.processPdfWithOcr(data, {
    mode: mod.OcrMode.Auto,
    pageNumbers: [page],
    dpi: Math.round(scale * 72),
    modelDirectory: runtime.value.modelDir,
    offline: true,
    minimumConfidence: INSPECTOR_MIN_CONFIDENCE,
  })
  const found = result.pages.find((item) => item.pageNumber === page)
  const words = normalizeInspectorSpans(
    (found?.spans ?? []).map((span) => ({
      text: span.text,
      confidence: span.confidence,
      x: span.x,
      y: span.y,
      width: span.width,
      height: span.height,
    })),
    pageWidthPt,
    pageHeightPt,
  )

  if (words.length === 0) {
    return err({
      code: 'OCR_PAGE_EMPTY',
      message: '本页未识别到文字，请确认是否为正文页',
    })
  }

  const cache: PdfOcrPageCache = {
    fileFingerprint,
    page,
    pageWidth: pageWidthPt,
    pageHeight: pageHeightPt,
    ocrScale: scale,
    words,
    createdAt: new Date().toISOString(),
  }

  await writePdfOcrPageCache(cache)
  return ok(cache)
}

/** 回退路径：tesseract（待 inspector 全量验证后删除） */
async function recognizePdfPageWithTesseract(
  payload: RecognizePdfPagePayload,
): Promise<Result<PdfOcrPageCache, AppError>> {
  const { filePath, fileFingerprint, page } = payload
  const scale = payload.scale ?? OCR_SCALE
  try {
    const component = await ensureOcrComponent()
    if (!component.ok) return component

    const { image, width, height } = await renderPdfPageImage(filePath, page, scale)
    const worker = await getOcrWorker()
    const { data } = await recognizeImageWithBlocks(worker, image)

    const words = normalizeOcrWords(extractTesseractWords(data), width, height)

    if (words.length === 0) {
      return err({
        code: 'OCR_PAGE_EMPTY',
        message: '本页未识别到文字，请确认是否为正文页',
      })
    }

    const cache: PdfOcrPageCache = {
      fileFingerprint,
      page,
      pageWidth: width / scale,
      pageHeight: height / scale,
      ocrScale: scale,
      words,
      createdAt: new Date().toISOString(),
    }

    await writePdfOcrPageCache(cache)
    return ok(cache)
  } catch (cause) {
    return err({
      code: 'OCR_FAILED',
      message: cause instanceof Error ? cause.message : '页面识别失败',
    })
  }
}
