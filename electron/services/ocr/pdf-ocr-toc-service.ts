import { readFile } from 'node:fs/promises'
import { pdf } from 'pdf-to-img'
import { err, ok, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import {
  defaultPdfPageOffset,
  extractOcrTocFromText,
  ocrTocToReaderUnits,
} from '@shared/reader/ocr-toc-extractor'
import type { PdfOcrTocCache, RecognizePdfTocPayload } from '@shared/types/ocr'
import { writePdfOcrTocCache } from './ocr-toc-cache'
import { getOcrWorker } from './ocr-worker'
import { recognizeImageWithBlocks } from './recognize-image'

export async function recognizePdfToc(
  payload: RecognizePdfTocPayload,
): Promise<Result<PdfOcrTocCache, AppError>> {
  const { filePath, fileFingerprint, fromPage, toPage, pageOffset } = payload
  if (fromPage < 1 || toPage < fromPage) {
    return err({ code: 'INVALID_ARGUMENT', message: '目录页范围无效' })
  }

  try {
    const data = await readFile(filePath)
    const doc = await pdf(data, { scale: 2 })
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
