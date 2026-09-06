/**
 * PDF 结构化解析（pdf-inspector WASM）纯逻辑：页码归一、Markdown 按页切分。
 * 与 Worker 传输、WASM 加载无关，可直接单测。
 * 页码约定：对外一律 1-indexed；WASM `processPdf` 本身也是 1-indexed，
 * 但 `classifyPdf` 是 0-indexed——归一函数是防呆层，调用方不得依赖裸值。
 */

/** 超过此体积不走 WASM（整档 parse 的内存与耗时不可控），静默回退 pdf.js */
export const PDF_STRUCTURE_MAX_BYTES = 200 * 1024 * 1024
/** Worker 单次解析超时（Rust 端常规档约 0.5s 量级，留足大部头余量） */
export const PDF_STRUCTURE_TIMEOUT_MS = 60_000

/** 将任意页码数组归一为 1-indexed 合法页：去非法、去重、排序 */
export function normalizeOneIndexedPages(
  pages: readonly number[],
  pageCount: number,
): number[] {
  if (!Number.isFinite(pageCount) || pageCount < 1) return []
  const seen = new Set<number>()
  for (const raw of pages) {
    if (!Number.isFinite(raw)) continue
    const page = Math.floor(raw)
    if (page < 1 || page > pageCount) continue
    seen.add(page)
  }
  return [...seen].sort((a, b) => a - b)
}

const PAGE_MARKER_RE = /<!--\s*Page\s+(\d+)\s*-->/g

/**
 * 按 `<!-- Page N -->` 标记切分整档 Markdown。
 * 标记前的首段归属 fallbackPage（inspector 的标记出现在页之间，首页无前导标记）。
 * 空段丢弃；同一页出现多次时按序拼接。
 */
export function splitMarkdownByPageMarkers(
  markdown: string,
  fallbackPage: number,
): Map<number, string> {
  const result = new Map<number, string>()
  const push = (page: number, chunk: string): void => {
    const body = chunk.trim()
    if (!body) return
    const prev = result.get(page)
    result.set(page, prev ? `${prev}\n${body}` : body)
  }

  let currentPage = fallbackPage
  let lastIndex = 0
  for (const match of markdown.matchAll(PAGE_MARKER_RE)) {
    const index = match.index ?? 0
    push(currentPage, markdown.slice(lastIndex, index))
    const next = Number.parseInt(match[1] ?? '', 10)
    if (Number.isFinite(next) && next >= 1) currentPage = next
    lastIndex = index + match[0].length
  }
  push(currentPage, markdown.slice(lastIndex))
  return result
}

/** 结构化正文可用：非空即用（空保护仍由 formatPdfPageTextForAgent 负责） */
export function isStructuredPageTextUsable(text: string): boolean {
  return text.trim().length > 0
}
