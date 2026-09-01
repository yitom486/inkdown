/**
 * 从 OCR 纯文本提取教材目录（王道 / 考研类常见格式）。
 */

export interface OcrTocEntry {
  title: string
  printedPage: number
  level: number
  raw: string
}

const NOISE_PATTERNS = [
  /官方\s*开源/i,
  /bilibili/i,
  /王道\s*计算机/i,
  /配套\s*视频/i,
  /兑换/i,
  /水印/i,
  /ISBN/i,
  /CIP/i,
  /邮编/i,
  /印张/i,
]

export function normalizeOcrChinese(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(/[·…．。，,]/g, '')
}

function isNoiseLine(line: string): boolean {
  const compact = normalizeOcrChinese(line)
  if (compact.length < 3) return true
  return NOISE_PATTERNS.some((p) => p.test(compact) || p.test(line))
}

export function cleanupOcrTocTitle(title: string): string {
  return title
    .replace(/^#]11/, '第1章')
    .replace(/^#]1/, '第1章')
    .replace(/^第\s*(\d+)\s*章/, '第$1章')
    .replace(/_{1,}/g, '')
    .replace(/["""]/g, '')
    .trim()
}

function inferLevel(title: string): number {
  if (/^第[0-9一二三四五六七八九十百千]+章/.test(title)) return 0
  if (/^第[0-9一二三四五六七八九十百千]+节/.test(title)) return 1
  const section = title.match(/^(\d+)\.(\d+)/)
  if (section) {
    const [, major, minor] = section
    if (minor === '0' || minor === '00') return 0
    if (major && minor) return minor.length <= 2 ? 1 : 2
  }
  return 1
}

const TOC_LINE = /^(.+?)(?:[.·…．。\-—–_\s]{1,8})?(\d{1,4})\s*$/

export function extractOcrTocFromText(text: string): OcrTocEntry[] {
  const entries: OcrTocEntry[] = []
  const seen = new Set<string>()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || isNoiseLine(line)) continue

    const compact = normalizeOcrChinese(line)
    const m = compact.match(TOC_LINE)
    if (!m) continue

    const title = cleanupOcrTocTitle(m[1].trim())
    const printedPage = Number.parseInt(m[2], 10)
    if (printedPage < 1 || printedPage > 3000) continue
    if (title.length < 2) continue
    if (!/[\u4e00-\u9fff]/.test(title) && !/^第\d+章/.test(title) && !/^\d+\.\d+/.test(title)) {
      continue
    }
    if (/^\d[\d.\-]*$/.test(title)) continue
    if (/^7-121/.test(title)) continue

    const key = `${title}|${printedPage}`
    if (seen.has(key)) continue
    seen.add(key)

    entries.push({
      title,
      printedPage,
      level: inferLevel(title),
      raw: line,
    })
  }

  return entries
}

export function defaultPdfPageOffset(tocPageRange: [number, number]): number {
  return tocPageRange[1]
}

export function ocrTocToReaderUnits(
  entries: OcrTocEntry[],
  pageOffset: number,
): Array<{ label: string; href: string; level: number }> {
  return entries.map((e) => ({
    label: e.title,
    href: String(Math.max(1, e.printedPage + pageOffset)),
    level: e.level,
  }))
}
