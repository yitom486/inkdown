import { readFile } from 'node:fs/promises'
import { err, ok, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import { normalizeOcrWords } from '@shared/reader/ocr-page-words'
import type { PdfOcrPageCache, PdfOcrScale, RecognizePdfPagePayload } from '@shared/types/ocr'
import { DEFAULT_PDF_OCR_SCALE } from '@shared/types/ocr'
import { writePdfOcrPageCache } from './ocr-page-cache'
import { ensureOcrComponent } from './ocr-component-manager'
import { getOcrWorker } from './ocr-worker'
import { extractTesseractWords } from './tesseract-words'
import { recognizeImageWithBlocks } from './recognize-image'

const OCR_SCALE = DEFAULT_PDF_OCR_SCALE

async function loadPdfConverter() {
  const mod = await import('pdf-to-img')
  return mod.pdf
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
  const { filePath, fileFingerprint, page } = payload
  const scale = payload.scale ?? OCR_SCALE
  if (page < 1) {
    return err({ code: 'INVALID_ARGUMENT', message: '页码无效' })
  }

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
