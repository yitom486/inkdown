import type { OcrTocEntry } from '@shared/types/ocr'

/**
 * 目录 AI 整理：把目录页 OCR 原文发给大模型做结构化抽取，
 * 结果进 PdfOcrTocEditor 当草稿由用户确认。页码对齐是确定性加法
 * （印刷页 + 偏移），不让模型猜，只让它做解析。
 */

export const TOC_AI_MAX_TEXT_CHARS = 30_000

export interface TocAiDraftEntry {
  title: string
  printedPage: number
  level: number
}

export interface TocAiParseResult {
  entries: OcrTocEntry[]
  /** 被丢弃的条目数（空标题/非法页码） */
  dropped: number
  /** 需用户留意的警告（页码倒退等），展示用 */
  warnings: string[]
}

export function buildTocAiPrompt(ocrText: string): string {
  const text =
    ocrText.length > TOC_AI_MAX_TEXT_CHARS
      ? ocrText.slice(0, TOC_AI_MAX_TEXT_CHARS)
      : ocrText
  return [
    '你是图书目录结构化助手。从下面的目录页 OCR 文本中提取章节条目。',
    '规则：',
    '1. 只输出一个 JSON 数组，不要输出其它文字，不要用代码块包裹之外的解释。',
    '2. 每个元素为 {"title": "章节标题", "printedPage": 印刷页码数字, "level": 层级数字}。',
    '3. level：章/部为 1，节为 2，小节为 3，以此类推；无法判断时填 1。',
    '4. printedPage 取标题同一行或紧邻的页码；标题跨行时把多行拼成一个标题。',
    '5. 忽略页眉页脚、广告、"目录"字样本身、省略号点线、登录提示等非目录噪音。',
    '6. 标题保留原文（含标点），只做去首尾空白；不要改写、不要续写缺失章节。',
    '目录页 OCR 文本如下：',
    text,
  ].join('\n')
}

/** 从模型回复中抠 JSON 数组（容忍 ```json 围栏与前后杂话） */
function extractJsonArraySlice(replyText: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(replyText)
  const candidate = (fenced?.[1] ?? replyText).trim()
  const start = candidate.indexOf('[')
  const end = candidate.lastIndexOf(']')
  if (start < 0 || end <= start) return null
  return candidate.slice(start, end + 1)
}

function toLevel(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return 1
  return Math.min(6, Math.max(1, Math.floor(n)))
}

function toPrintedPage(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(n) || n < 1) return null
  return Math.floor(n)
}

export function parseTocAiEntries(replyText: string): TocAiParseResult {
  const warnings: string[] = []
  let dropped = 0
  const slice = extractJsonArraySlice(replyText)
  if (!slice) {
    return { entries: [], dropped: 0, warnings: ['模型回复中没有找到 JSON 数组'] }
  }
  let raw: unknown
  try {
    raw = JSON.parse(slice) as unknown
  } catch {
    return { entries: [], dropped: 0, warnings: ['模型回复的 JSON 解析失败'] }
  }
  if (!Array.isArray(raw)) {
    return { entries: [], dropped: 0, warnings: ['模型回复不是 JSON 数组'] }
  }

  const entries: OcrTocEntry[] = []
  let prevPage = 0
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      dropped += 1
      continue
    }
    const record = item as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const printedPage = toPrintedPage(record.printedPage)
    if (!title || printedPage === null) {
      dropped += 1
      continue
    }
    if (printedPage < prevPage) {
      warnings.push(`「${title}」页码 ${printedPage} 小于上一条 ${prevPage}，请核对`)
    }
    prevPage = printedPage
    entries.push({ title, printedPage, level: toLevel(record.level) })
  }
  if (dropped > 0) {
    warnings.push(`丢弃 ${dropped} 条空标题/非法页码`)
  }
  return { entries, dropped, warnings }
}
