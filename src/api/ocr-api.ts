import type {
  GetPdfOcrTocPayload,
  PdfOcrTocCache,
  RecognizePdfTocPayload,
} from '@shared/types/ocr'
import type { AppError } from '@shared/core/errors'
import type { Result } from '@shared/core/result'

function api() {
  if (!window.electronAPI) {
    throw new Error('electronAPI 不可用')
  }
  return window.electronAPI
}

export function getPdfOcrToc(
  payload: GetPdfOcrTocPayload,
): Promise<Result<PdfOcrTocCache, AppError>> {
  return api().getPdfOcrToc(payload)
}

export function recognizePdfOcrToc(
  payload: RecognizePdfTocPayload,
): Promise<Result<PdfOcrTocCache, AppError>> {
  return api().recognizePdfOcrToc(payload)
}

export function deletePdfOcrToc(
  payload: GetPdfOcrTocPayload,
): Promise<Result<void, AppError>> {
  return api().deletePdfOcrToc(payload)
}
