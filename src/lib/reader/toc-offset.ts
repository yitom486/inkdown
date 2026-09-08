/**
 * 目录页码偏移自动推算：拿目录前若干标题去正文页原生文字层里找锚点，
 * offset = PDF 页 − 印刷页，多标题共识（众数）即偏移。
 * 只读原生文字层（不触发 OCR）：扫描正文页无文字层时自然匹配不上，
 * 此时返回 null 并提示手填——这是预期行为，不是失败。
 */

export interface TocOffsetCandidate {
  title: string
  printedPage: number
}

export interface TocOffsetSuggestion {
  offset: number
  /** 参与共识的标题数 / 成功锚定的标题数 */
  agree: number
  total: number
}

export interface TocOffsetSearchOptions {
  pageCount: number
  /** 目录页本身（含前后）：标题出现在这里不算锚定，必须跳过 */
  skipPdfPages?: readonly number[]
  /** 取前 N 个有印刷页码的标题做锚点 */
  maxCandidates?: number
  /** 每个标题最多向后扫多少页 */
  maxSearchPages?: number
  /** 归一化后短于此长度的标题不参与（噪音） */
  minTitleLength?: number
}

/** 归一化：去空白标点、小写；中日韩表意文字不受大小写影响 */
export function normalizeTocTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export async function suggestTocPageOffset(
  candidates: readonly TocOffsetCandidate[],
  readNativePageText: (pdfPage: number) => Promise<string | null>,
  options: TocOffsetSearchOptions,
): Promise<TocOffsetSuggestion | null> {
  const {
    pageCount,
    skipPdfPages = [],
    maxCandidates = 6,
    maxSearchPages = 120,
    minTitleLength = 4,
  } = options
  const skip = new Set(skipPdfPages)
  const usable = candidates
    .filter((c) => Number.isFinite(c.printedPage) && c.printedPage >= 1)
    .slice(0, maxCandidates)

  const votes = new Map<number, number>()
  let total = 0
  for (const candidate of usable) {
    const needle = normalizeTocTitle(candidate.title)
    if (needle.length < minTitleLength) continue
    // 偏移通常 ≥ 0（正文在目录之后），从印刷页码同号 PDF 页开始向后扫
    const startPage = Math.min(pageCount, Math.max(1, candidate.printedPage))
    const endPage = Math.min(pageCount, startPage + maxSearchPages)
    for (let pdfPage = startPage; pdfPage <= endPage; pdfPage += 1) {
      if (skip.has(pdfPage)) continue
      let text: string | null = null
      try {
        text = await readNativePageText(pdfPage)
      } catch {
        continue
      }
      if (!text) continue
      if (normalizeTocTitle(text).includes(needle)) {
        const offset = pdfPage - candidate.printedPage
        votes.set(offset, (votes.get(offset) ?? 0) + 1)
        total += 1
        break
      }
    }
  }

  if (total === 0) return null
  let bestOffset = 0
  let bestAgree = 0
  for (const [offset, agree] of votes) {
    if (agree > bestAgree) {
      bestAgree = agree
      bestOffset = offset
    }
  }
  return { offset: bestOffset, agree: bestAgree, total }
}
