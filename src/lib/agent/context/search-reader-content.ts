import { getReaderContentProvider, type ReaderUnitText } from './reader-content-registry'

export const READER_SEARCH_MAX_HITS = 20
/** 命中处前后各截取的字数，够模型判断语境又不至于灌满上下文 */
const SNIPPET_RADIUS = 60

export interface ReaderSearchHit {
  /** 人类可读定位：章节标题或「第 N 页」 */
  label: string
  snippet: string
  /** 该单元内的命中次数 */
  count: number
}

export interface ReaderSearchResult {
  query: string
  hits: ReaderSearchHit[]
  totalMatches: number
  /** 命中过多提前收尾，结果不完整 */
  truncated: boolean
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) return count
    count += 1
    from = at + needle.length
  }
}

/** 取命中处前后一小段，折叠空白并补省略号 */
export function buildSnippet(text: string, at: number, length: number): string {
  const start = Math.max(0, at - SNIPPET_RADIUS)
  const end = Math.min(text.length, at + length + SNIPPET_RADIUS)
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`
}

export function searchUnit(unit: ReaderUnitText, query: string): ReaderSearchHit | null {
  const at = unit.text.toLowerCase().indexOf(query.toLowerCase())
  if (at < 0) return null
  return {
    label: unit.label,
    snippet: buildSnippet(unit.text, at, query.length),
    count: countOccurrences(unit.text.toLowerCase(), query.toLowerCase()),
  }
}

export async function searchReaderContent(rawQuery: string): Promise<ReaderSearchResult> {
  const query = rawQuery.trim()
  if (!query) throw new Error('检索词不能为空')

  const provider = getReaderContentProvider()
  if (!provider) throw new Error('当前没有打开的文档')
  if (!provider.iterateUnits) throw new Error('当前文档格式暂不支持全文检索')

  const hits: ReaderSearchHit[] = []
  let totalMatches = 0
  let truncated = false

  for await (const unit of provider.iterateUnits()) {
    const hit = searchUnit(unit, query)
    if (!hit) continue
    hits.push(hit)
    totalMatches += hit.count
    if (hits.length >= READER_SEARCH_MAX_HITS) {
      truncated = true
      break
    }
  }

  return { query, hits, totalMatches, truncated }
}
