import { readFile } from 'node:fs/promises'
import { err, ok, type Result } from '@shared/core/result'
import { toAppError, type AppError } from '@shared/core/errors'
import type {
  InspectorBookMarkdown,
  InspectorPdfClassification,
} from '@shared/types/pdf-inspect'

/**
 * pdf-inspector 主进程封装（分类 + 原生抽取；_loading 纯抽取，不碰 OCR 运行时）。
 * 页码约定：对外一律 1-indexed；上游 classifyPdfAsync 是 0-indexed，此处归一。
 * OCR 选择性识别（PP-OCRv6 + PDFium/ORT 外部运行时）另起任务，本模块不动。
 */

async function loadPdfInspector() {
  return await import('@firecrawl/pdf-inspector')
}

export type InspectorPdfType = 'TextBased' | 'Scanned' | 'ImageBased' | 'Mixed'

export interface InspectorPageMarkdown {
  /** 1-indexed */
  page: number
  markdown: string
}

export interface InspectorPagesMarkdown {
  pages: InspectorPageMarkdown[]
  /** 1-indexed */
  pagesWithTables: number[]
  /** 1-indexed */
  pagesWithColumns: number[]
  /** 1-indexed */
  pagesNeedingOcr: number[]
  isComplex: boolean
}

function toServiceError(cause: unknown, fallback: string): Result<never, AppError> {
  if (
    cause &&
    typeof cause === 'object' &&
    'code' in cause &&
    (cause as { code?: unknown }).code === 'ENOENT'
  ) {
    return err({ code: 'FILE_NOT_FOUND', message: fallback })
  }
  return err(toAppError(cause, fallback))
}

function toOneIndexed(pages: readonly number[]): number[] {
  return pages
    .filter((page) => Number.isFinite(page) && page >= 0)
    .map((page) => Math.floor(page) + 1)
}

export async function classifyPdfDocument(
  filePath: string,
): Promise<Result<InspectorPdfClassification, AppError>> {
  try {
    const data = await readFile(filePath)
    const mod = await loadPdfInspector()
    const result = await mod.classifyPdfAsync(data)
    return ok({
      pdfType: result.pdfType,
      pageCount: result.pageCount,
      pagesNeedingOcr: toOneIndexed(result.pagesNeedingOcr),
      confidence: result.confidence,
    })
  } catch (cause) {
    return toServiceError(cause, 'PDF 分类失败')
  }
}

/**
 * 按页抽取 Markdown（原生文字层；扫描页返回空，由调用方决定是否走 OCR）。
 * @param pages 1-indexed 页码；不传则全档
 */
export async function extractPdfPagesMarkdown(
  filePath: string,
  pages?: number[],
): Promise<Result<InspectorPagesMarkdown, AppError>> {
  try {
    const data = await readFile(filePath)
    const mod = await loadPdfInspector()
    const zeroIndexed = pages
      ?.filter((page) => Number.isFinite(page) && page >= 1)
      .map((page) => Math.floor(page) - 1)
    const result = await mod.extractPagesMarkdownAsync(data, zeroIndexed)
    return ok({
      pages: result.pages.map((page) => ({
        page: Math.floor(page.page) + 1,
        markdown: page.markdown ?? '',
      })),
      pagesWithTables: result.pagesWithTables,
      pagesWithColumns: result.pagesWithColumns,
      pagesNeedingOcr: result.pagesNeedingOcr,
      isComplex: result.isComplex,
    })
  } catch (cause) {
    return toServiceError(cause, 'PDF 正文抽取失败')
  }
}

/**
 * 整档 Markdown（原生文字层；扫描页为空，由调用方决定是否走 OCR）。
 * 按 `<!-- Page N -->` 标记拼接，与 WASM 输出同格式，渲染端复用切分。
 */
export async function extractPdfBookMarkdown(
  filePath: string,
): Promise<Result<InspectorBookMarkdown, AppError>> {
  try {
    const data = await readFile(filePath)
    const mod = await loadPdfInspector()
    const result = await mod.extractPagesMarkdownAsync(data)
    const ordered = [...result.pages].sort((a, b) => a.page - b.page)
    const parts: string[] = []
    for (const page of ordered) {
      const pageNum = Math.floor(page.page) + 1
      const body = page.markdown ?? ''
      if (parts.length === 0) {
        parts.push(body)
      } else {
        parts.push(`<!-- Page ${pageNum} -->\n${body}`)
      }
    }
    return ok({
      markdown: parts.join('\n'),
      pageCount: ordered.length,
      pagesWithTables: result.pagesWithTables,
    })
  } catch (cause) {
    return toServiceError(cause, 'PDF 整档解析失败')
  }
}
