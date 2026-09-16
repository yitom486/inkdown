/**
 * 罗盘目录签名：规范化后的真实页 + 标题 + 层级哈希，不含本机路径。
 * 主/渲染进程共用（纯函数，无 Node 依赖，渲染端可同步计算当前 OCR 目录签名）。
 */

export interface TocSignatureEntry {
  title: string
  realPage: number
  level: number
}

/** 标题规范化：NFC + 去首尾空 + 连续空白折叠为单空格 */
export function normalizeTocTitle(title: string): string {
  return title.normalize('NFC').trim().replace(/\s+/g, ' ')
}

function cyrb53(input: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/**
 * 目录签名：过滤非法条目 → 规范标题 → 按（真实页，层级，标题码点）排序
 * → `level:realPage:title` 换行拼接 → 双种子 cyrb53 拼 28 位 hex。
 * 空目录返回 ''（与 books.toc_signature 缺省值一致，不误报待更新）。
 */
export function computeTocSignature(entries: readonly TocSignatureEntry[]): string {
  const normalized: TocSignatureEntry[] = []
  for (const entry of entries) {
    if (!entry || !Number.isFinite(entry.realPage) || !Number.isFinite(entry.level)) continue
    const realPage = Math.round(entry.realPage)
    const level = Math.trunc(entry.level)
    if (!Number.isInteger(realPage) || realPage < 1 || !Number.isInteger(level) || level < 0) continue
    const title = normalizeTocTitle(typeof entry.title === 'string' ? entry.title : '')
    if (!title) continue
    normalized.push({ title, realPage, level })
  }
  if (normalized.length === 0) return ''
  normalized.sort((a, b) => {
    if (a.realPage !== b.realPage) return a.realPage - b.realPage
    if (a.level !== b.level) return a.level - b.level
    if (a.title === b.title) return 0
    return a.title < b.title ? -1 : 1
  })
  const canonical = normalized.map((e) => `${e.level}:${e.realPage}:${e.title}`).join('\n')
  const high = cyrb53(canonical, 0x12345678).toString(16).padStart(14, '0')
  const low = cyrb53(canonical, 0x87654321).toString(16).padStart(14, '0')
  return `${high}${low}`
}
