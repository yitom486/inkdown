import type {
  ClassifyPdfDocumentPayload,
  ExtractPdfBookMarkdownPayload,
  InspectorBookMarkdown,
  InspectorPdfClassification,
} from '@shared/types/pdf-inspect'
import type { AppError } from '@shared/core/errors'
import type { Result } from '@shared/core/result'

function api() {
  if (!window.electronAPI) {
    throw new Error('electronAPI 不可用')
  }
  return window.electronAPI
}

/** pdf-inspector 分类（类型/页数/待 OCR 页，主进程整档速扫） */
export function classifyPdfDocument(
  payload: ClassifyPdfDocumentPayload,
): Promise<Result<InspectorPdfClassification, AppError>> {
  return api().classifyPdfDocument(payload)
}

/** pdf-inspector 整档 Markdown（原生文字层，按页标记拼接） */
export function extractPdfBookMarkdown(
  payload: ExtractPdfBookMarkdownPayload,
): Promise<Result<InspectorBookMarkdown, AppError>> {
  return api().extractPdfBookMarkdown(payload)
}
