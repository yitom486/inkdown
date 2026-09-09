import {
  backfillMissingPages,
  isBareChapterTitle,
  isWatermarkTocEntry,
} from '@shared/reader/ocr-toc-extractor'
import type { OcrTocEntrySource } from '@shared/types/ocr'

/**
 * 目录 Agent 草稿本（渲染进程内存单例）。
 * 目录工具（toc_* MCP）经快照回路写到这里，人点保存才进真正的
 * ocr-toc-cache；与 prompt-JSON 解析路径互斥消费（take 即清空）。
 */

export interface TocDraftEntry {
  title: string
  printedPage: number
  level: number
  /** 工具写入一律标 ai（0-based 已归一，合并裁决用） */
  source?: OcrTocEntrySource
}

interface TocDraftState {
  fingerprint: string
  entries: TocDraftEntry[]
  updatedAt: number
}

let draft: TocDraftState | null = null

function toPrintedPage(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isInteger(n) || n < 1 || n > 3000) return null
  return n
}


/**
 * 工具入参 1-based（章=1，见提示词）→ 存储 0-based（章=0，与启发式同口径）。
 * 与 toc-ai JSON 路径同口径，合并裁决不再错位。
 */
function toLevel(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isInteger(n)) return 0
  return Math.min(6, Math.max(0, n - 1))
}

/** 单条校验（与 toc-ai 解析同口径：空标题/非法页码/水印一律丢弃） */
export function sanitizeTocDraftEntry(raw: unknown): TocDraftEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  if (!title) return null
  const printedPage = toPrintedPage(record.printedPage)
  if (printedPage === null) return null
  if (isWatermarkTocEntry(title)) return null
  return { title, printedPage, level: toLevel(record.level), source: 'ai' as const }
}

/** 整单替换（toc_replace_all 主路径，幂等） */
export function writeTocDraft(
  fingerprint: string,
  rawEntries: unknown,
): { count: number; dropped: number } {
  if (!Array.isArray(rawEntries)) {
    draft = { fingerprint, entries: [], updatedAt: Date.now() }
    return { count: 0, dropped: 0 }
  }
  // 宽松过一遍：留空页码给回填（与启发式同口径），无号章行直接丢弃
  const prelim: { title: string; printedPage: number | null; level: number; source: OcrTocEntrySource }[] = []
  let dropped = 0
  for (const item of rawEntries) {
    if (typeof item !== 'object' || item === null) {
      dropped += 1
      continue
    }
    const record = item as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    if (!title || isWatermarkTocEntry(title)) {
      dropped += 1
      continue
    }
    const printedPage = toPrintedPage(record.printedPage)
    if (printedPage === null && isBareChapterTitle(title)) {
      dropped += 1
      continue
    }
    prelim.push({ title, printedPage, level: toLevel(record.level), source: 'ai' })
  }
  const entries: TocDraftEntry[] = []
  for (const entry of backfillMissingPages(prelim)) {
    if (entry.printedPage === null) {
      dropped += 1
      continue
    }
    entries.push({ title: entry.title, printedPage: entry.printedPage, level: entry.level, source: entry.source })
  }
  draft = { fingerprint, entries, updatedAt: Date.now() }
  return { count: entries.length, dropped }
}

/** 同标题更新页码/层级，否则追加 */
export function upsertTocDraftEntry(
  fingerprint: string,
  rawEntry: unknown,
): { action: 'added' | 'updated'; count: number } | { error: string } {
  const entry = sanitizeTocDraftEntry(rawEntry)
  if (!entry) return { error: '条目无效（空标题/非法页码/水印）' }
  if (!draft || draft.fingerprint !== fingerprint) {
    draft = { fingerprint, entries: [entry], updatedAt: Date.now() }
    return { action: 'added', count: 1 }
  }
  const index = draft.entries.findIndex((item) => item.title === entry.title)
  if (index >= 0) {
    draft.entries[index] = entry
  } else {
    draft.entries.push(entry)
  }
  draft.updatedAt = Date.now()
  return { action: index >= 0 ? 'updated' : 'added', count: draft.entries.length }
}

/** 按序号或标题删一条 */
export function deleteTocDraftEntry(
  fingerprint: string,
  selector: { index?: unknown; title?: unknown },
): { removed: number; count: number } {
  if (!draft || draft.fingerprint !== fingerprint) return { removed: 0, count: draft?.entries.length ?? 0 }
  const { index, title } = selector
  let at = -1
  if (typeof index === 'number' && Number.isInteger(index)) {
    at = index >= 0 && index < draft.entries.length ? index : -1
  } else if (typeof title === 'string' && title.trim()) {
    at = draft.entries.findIndex((item) => item.title === title.trim())
  }
  if (at < 0) return { removed: 0, count: draft.entries.length }
  draft.entries.splice(at, 1)
  draft.updatedAt = Date.now()
  return { removed: 1, count: draft.entries.length }
}

export function readTocDraft(): TocDraftState | null {
  return draft
}

/**
 * 取走草稿（指纹一致才给，且取即清空，避免与 JSON 回退路径重复应用）。
 * 指纹不符返回 null 且保留草稿。
 */
export function takeTocDraft(expectedFingerprint: string): TocDraftEntry[] | null {
  if (!draft || draft.fingerprint !== expectedFingerprint || draft.entries.length === 0) {
    return null
  }
  const entries = draft.entries
  draft = null
  return entries
}

export function clearTocDraft(): void {
  draft = null
}
