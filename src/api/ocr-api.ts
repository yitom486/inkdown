import type {
  GetPdfOcrPagePayload,
  GetPdfOcrTocPayload,
  ListPdfOcrPagesPayload,
  PdfOcrPageCache,
  PdfOcrTocCache,
  RecognizePdfPagePayload,
  RecognizePdfTocPayload,
  SavePdfOcrTocPayload,
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

export function getPdfOcrPage(
  payload: GetPdfOcrPagePayload,
): Promise<Result<PdfOcrPageCache, AppError>> {
  return api().getPdfOcrPage(payload)
}

export function recognizePdfOcrPage(
  payload: RecognizePdfPagePayload,
): Promise<Result<PdfOcrPageCache, AppError>> {
  return api().recognizePdfOcrPage(payload)
}

export function listPdfOcrPages(
  payload: ListPdfOcrPagesPayload,
): Promise<Result<number[], AppError>> {
  return api().listPdfOcrPages(payload)
}

export function clearPdfOcrCache(
  payload: GetPdfOcrTocPayload,
): Promise<Result<void, AppError>> {
  return api().clearPdfOcrCache(payload)
}

export function clearAllPdfOcrCache(): Promise<Result<void, AppError>> {
  return api().clearAllPdfOcrCache()
}

export function savePdfOcrToc(
  payload: SavePdfOcrTocPayload,
): Promise<Result<void, AppError>> {
  return api().savePdfOcrToc(payload)
}
