import type { ReadingMark } from '@shared/types/reading-mark'
import { normalizeLoadKey } from '@/lib/reader/reader-viewport-nav'
import {
  highlightSortKey,
  isHighlightPassage,
  passageExcerpt,
  passageNote,
} from '@/lib/reader/reading-mark-passages'

/** 批注 / 纯重点 / 综合 */
export type ReadingNotesContentKind = 'notes' | 'highlights' | 'combined'
/** 当前章 / 全书 */
export type ReadingNotesScope = 'chapter' | 'book'

export interface ReadingNotesChapterRef {
  /** 目录项唯一键（保留层级，不因同 href 去重） */
  key: string
  label: string
  /** 0 = 章 → ##，1 = 节 → ###，以此类推（最多 ######） */
  level: number
  /** 与标记锚点对齐用（epub href / mobi chapterId / pdf page） */
  matchKey: string
}

export interface ReadingNotesExportInput {
  marks: ReadingMark[]
  toc: ReadingNotesChapterRef[]
  contentKind: ReadingNotesContentKind
  scope: ReadingNotesScope
  /** 本章导出时必填 */
  currentChapter?: ReadingNotesChapterRef | null
  bookTitle: string
  /** 解析器：把标记归到章；E1 仅 epub/mobi */
  resolveChapter: (mark: ReadingMark, toc: ReadingNotesChapterRef[]) => ReadingNotesChapterRef
  now?: Date
  /** 同秒冲突时追加，默认不写 */
  nameSuffix?: string
}

export interface ReadingNotesExportResult {
  markdown: string
  suggestedName: string
  markCount: number
  chapterCount: number
}

export function filterMarksForNotesExport(
  marks: ReadingMark[],
  contentKind: ReadingNotesContentKind,
): ReadingMark[] {
  const base = marks
    .filter(isHighlightPassage)
    .sort((a, b) => highlightSortKey(a).localeCompare(highlightSortKey(b), 'en'))

  switch (contentKind) {
    case 'notes':
      return base.filter((mark) => Boolean(passageNote(mark)))
    case 'highlights':
      return base.filter((mark) => !passageNote(mark))
    case 'combined':
      // 综合：高度重叠的重点/批注合并为一条（取最长摘录 + 保留批注）
      return mergeOverlappingPassages(base)
  }
}

/** 摘录重叠度：一方包含另一方时 = 较短/较长；完全相同为 1 */
export function excerptOverlapRatio(a: string, b: string): number {
  const left = a.trim()
  const right = b.trim()
  if (!left || !right) return 0
  if (left === right) return 1
  const longer = left.length >= right.length ? left : right
  const shorter = left.length >= right.length ? right : left
  if (!longer.includes(shorter)) return 0
  return shorter.length / longer.length
}

const COMBINED_OVERLAP_THRESHOLD = 0.8

function sameMergeBucket(a: ReadingMark, b: ReadingMark): boolean {
  const aa = a.anchor
  const ba = b.anchor
  if (aa.format !== ba.format) return false
  switch (aa.format) {
    case 'epub':
      return (
        ba.format === 'epub' &&
        normalizeLoadKey(aa.href ?? aa.cfi) === normalizeLoadKey(ba.href ?? ba.cfi)
      )
    case 'mobi':
      return ba.format === 'mobi' && aa.chapterId === ba.chapterId
    case 'pdf':
      return ba.format === 'pdf' && aa.page === ba.page
  }
}

/** 合并后保留最长摘录；有批注则走批注块（note + 引用） */
export function coalesceOverlappingMarks(a: ReadingMark, b: ReadingMark): ReadingMark {
  const excerptA = passageExcerpt(a)
  const excerptB = passageExcerpt(b)
  const longerExcerpt = excerptA.length >= excerptB.length ? excerptA : excerptB
  const note = passageNote(a) || passageNote(b) || undefined
  const preferNote = Boolean(passageNote(a))
    ? a
    : Boolean(passageNote(b))
      ? b
      : excerptA.length >= excerptB.length
        ? a
        : b

  return {
    ...preferNote,
    excerpt: longerExcerpt,
    note,
    // 有重点参与合并 → 重点（+批注）；否则纯批注
    kind: a.kind === 'highlight' || b.kind === 'highlight' ? 'highlight' : 'note',
  }
}

/** 同章/同页内，重叠度 ≥ 80% 的重点与批注合并为一条 */
export function mergeOverlappingPassages(
  marks: ReadingMark[],
  threshold = COMBINED_OVERLAP_THRESHOLD,
): ReadingMark[] {
  const remaining = [...marks]
  const merged: ReadingMark[] = []

  while (remaining.length > 0) {
    let current = remaining.shift()!
    let i = 0
    while (i < remaining.length) {
      const other = remaining[i]!
      if (
        sameMergeBucket(current, other) &&
        excerptOverlapRatio(passageExcerpt(current), passageExcerpt(other)) >= threshold
      ) {
        current = coalesceOverlappingMarks(current, other)
        remaining.splice(i, 1)
        continue
      }
      i += 1
    }
    merged.push(current)
  }

  return merged.sort((a, b) => highlightSortKey(a).localeCompare(highlightSortKey(b), 'en'))
}

function unknownChapter(key = 'unknown', label = '未分章'): ReadingNotesChapterRef {
  return { key, label, level: 0, matchKey: key }
}

/** 同文件多个目录项时取层级最深（小节优先于章） */
function pickTocByMatchKey(
  toc: ReadingNotesChapterRef[],
  matchKey: string,
): ReadingNotesChapterRef | undefined {
  const hits = toc.filter((entry) => (entry.matchKey || entry.key) === matchKey)
  if (hits.length === 0) return undefined
  return hits.reduce((best, item) => ((item.level ?? 0) >= (best.level ?? 0) ? item : best))
}

export function resolveEpubChapter(
  mark: ReadingMark,
  toc: ReadingNotesChapterRef[],
): ReadingNotesChapterRef {
  if (mark.anchor.format !== 'epub') {
    return unknownChapter()
  }
  const matchKey = normalizeLoadKey(mark.anchor.href ?? mark.anchor.cfi)
  const hit = pickTocByMatchKey(toc, matchKey)
  if (hit) return hit
  const fallbackLabel =
    mark.anchor.href?.split(/[/\\]/).pop()?.split('#')[0] || mark.anchor.href || '未分章'
  return unknownChapter(matchKey || 'unknown', fallbackLabel)
}

export function resolveMobiChapter(
  mark: ReadingMark,
  toc: ReadingNotesChapterRef[],
): ReadingNotesChapterRef {
  if (mark.anchor.format !== 'mobi') {
    return unknownChapter()
  }
  const matchKey = mark.anchor.chapterId
  const hit = pickTocByMatchKey(toc, matchKey)
  if (hit) return hit
  return unknownChapter(matchKey || 'unknown', matchKey || '未分章')
}

/** E2 面板预览：按页分组（导出 resolve 另议） */
export function resolvePdfPageChapter(
  mark: ReadingMark,
  _toc: ReadingNotesChapterRef[],
): ReadingNotesChapterRef {
  if (mark.anchor.format !== 'pdf') {
    return unknownChapter()
  }
  const key = `page-${mark.anchor.page}`
  return { key, label: `第 ${mark.anchor.page} 页`, level: 0, matchKey: key }
}

export function tocFromPdfPages(marks: ReadingMark[]): ReadingNotesChapterRef[] {
  const seen = new Set<string>()
  const toc: ReadingNotesChapterRef[] = []
  for (const mark of marks) {
    if (mark.anchor.format !== 'pdf') continue
    const key = `page-${mark.anchor.page}`
    if (seen.has(key)) continue
    seen.add(key)
    toc.push({ key, matchKey: key, label: `第 ${mark.anchor.page} 页`, level: 0 })
  }
  return toc.sort((a, b) => a.key.localeCompare(b.key, 'en'))
}

export function tocFromEpubUnits(
  units: Array<{ href: string; label: string; level?: number }>,
): ReadingNotesChapterRef[] {
  const toc: ReadingNotesChapterRef[] = []
  units.forEach((unit, index) => {
    const matchKey = normalizeLoadKey(unit.href)
    if (!matchKey) return
    toc.push({
      key: `${index}:${matchKey}`,
      matchKey,
      label: unit.label.trim() || matchKey,
      level: Math.max(0, unit.level ?? 0),
    })
  })
  return toc
}

export function tocFromMobiUnits(
  units: Array<{ id: string; label: string; level?: number }>,
): ReadingNotesChapterRef[] {
  const toc: ReadingNotesChapterRef[] = []
  units.forEach((unit, index) => {
    const matchKey = unit.id
    if (!matchKey) return
    toc.push({
      key: `${index}:${matchKey}`,
      matchKey,
      label: unit.label.trim() || matchKey,
      level: Math.max(0, unit.level ?? 0),
    })
  })
  return toc
}

/** 章 = ##，节 = ###；Markdown 最多六级 */
export function markdownHeadingPrefix(level: number): string {
  const depth = Math.min(6, Math.max(2, level + 2))
  return '#'.repeat(depth)
}

/** 文件名单段：书名短、章名可稍长 */
const BOOK_NAME_MAX = 25
const CHAPTER_NAME_MAX = 36

function sanitizeFilePart(value: string, maxLen = BOOK_NAME_MAX): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  if (!cleaned) return 'untitled'
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() : cleaned
}

export function formatExportTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  )
}

export function buildReadingNotesFileName(options: {
  bookTitle: string
  chapterLabel?: string | null
  scope: ReadingNotesScope
  now?: Date
  nameSuffix?: string
}): string {
  const book = sanitizeFilePart(options.bookTitle, BOOK_NAME_MAX)
  const stamp = formatExportTimestamp(options.now)
  const suffix = options.nameSuffix ? `-${sanitizeFilePart(options.nameSuffix, 8)}` : ''
  if (options.scope === 'chapter' && options.chapterLabel) {
    const chapter = sanitizeFilePart(options.chapterLabel, CHAPTER_NAME_MAX)
    // 全角冒号连接：Windows 禁止 ASCII `:`
    return `${book}：${chapter}-${stamp}${suffix}.md`
  }
  return `${book}-${stamp}${suffix}.md`
}

function renderMarkBlock(mark: ReadingMark): string {
  const excerpt = passageExcerpt(mark)
  const note = passageNote(mark)
  const quote = `> ${excerpt.replace(/\n/g, '\n> ')}`
  if (note) {
    // 「重点」标签始终加粗；纯批注无此前缀
    const body = mark.kind === 'highlight' ? `**重点**：${note}` : note
    return `${body}\n\n${quote}`
  }
  return `**重点**\n\n${quote}`
}

export function buildReadingNotesMarkdown(options: {
  bookTitle: string
  chapters: Array<{ label: string; marks: ReadingMark[]; level?: number }>
}): string {
  const parts: string[] = [`# ${options.bookTitle.trim() || '笔记'}`]

  for (const chapter of options.chapters) {
    parts.push(`${markdownHeadingPrefix(chapter.level ?? 0)} ${chapter.label}`)
    if (chapter.marks.length === 0) continue
    const blocks = chapter.marks.map(renderMarkBlock)
    parts.push(blocks.join('\n\n---\n\n'))
  }

  return `${parts.join('\n\n')}\n`
}

function descendantHasMarks(
  toc: ReadingNotesChapterRef[],
  start: number,
  buckets: Map<string, { marks: ReadingMark[] }>,
): boolean {
  const rootLevel = toc[start]?.level ?? 0
  for (let i = start + 1; i < toc.length; i++) {
    const item = toc[i]!
    if ((item.level ?? 0) <= rootLevel) break
    if ((buckets.get(item.key)?.marks.length ?? 0) > 0) return true
  }
  return false
}

export function groupMarksByChapter(options: {
  marks: ReadingMark[]
  toc: ReadingNotesChapterRef[]
  resolveChapter: (mark: ReadingMark, toc: ReadingNotesChapterRef[]) => ReadingNotesChapterRef
  /** 全书导出：无笔记的祖先标题仍输出，以保留章/节层级 */
  includeAncestorHeadings?: boolean
}): Array<{ key: string; matchKey: string; label: string; level: number; marks: ReadingMark[] }> {
  const buckets = new Map<string, { matchKey: string; label: string; level: number; marks: ReadingMark[] }>()

  for (const mark of options.marks) {
    const chapter = options.resolveChapter(mark, options.toc)
    const existing = buckets.get(chapter.key)
    if (existing) {
      existing.marks.push(mark)
      continue
    }
    buckets.set(chapter.key, {
      matchKey: chapter.matchKey || chapter.key,
      label: chapter.label,
      level: chapter.level ?? 0,
      marks: [mark],
    })
  }

  const ordered: Array<{
    key: string
    matchKey: string
    label: string
    level: number
    marks: ReadingMark[]
  }> = []
  const used = new Set<string>()

  options.toc.forEach((entry, index) => {
    const bucket = buckets.get(entry.key)
    const ownMarks = bucket?.marks ?? []
    const keepAncestor =
      options.includeAncestorHeadings && ownMarks.length === 0 && descendantHasMarks(options.toc, index, buckets)
    if (ownMarks.length === 0 && !keepAncestor) return
    ordered.push({
      key: entry.key,
      matchKey: entry.matchKey || entry.key,
      label: entry.label,
      level: entry.level ?? 0,
      marks: ownMarks,
    })
    used.add(entry.key)
  })

  for (const [key, bucket] of buckets) {
    if (used.has(key) || bucket.marks.length === 0) continue
    ordered.push({
      key,
      matchKey: bucket.matchKey,
      label: bucket.label,
      level: bucket.level,
      marks: bucket.marks,
    })
  }

  return ordered
}

export function buildReadingNotesExport(input: ReadingNotesExportInput): ReadingNotesExportResult | null {
  let marks = filterMarksForNotesExport(input.marks, input.contentKind)

  if (input.scope === 'chapter') {
    const current = input.currentChapter
    if (!current?.key && !current?.matchKey) return null
    const match = current.matchKey || current.key
    marks = marks.filter((mark) => {
      const resolved = input.resolveChapter(mark, input.toc)
      return (resolved.matchKey || resolved.key) === match
    })
  }

  if (marks.length === 0) return null

  const chapters =
    input.scope === 'chapter' && input.currentChapter
      ? [
          {
            key: input.currentChapter.key,
            label: input.currentChapter.label,
            level: input.currentChapter.level ?? 0,
            marks,
          },
        ]
      : groupMarksByChapter({
          marks,
          toc: input.toc,
          resolveChapter: input.resolveChapter,
          includeAncestorHeadings: true,
        })

  const markdown = buildReadingNotesMarkdown({
    bookTitle: input.bookTitle,
    chapters,
  })

  const suggestedName = buildReadingNotesFileName({
    bookTitle: input.bookTitle,
    chapterLabel: input.scope === 'chapter' ? input.currentChapter?.label : null,
    scope: input.scope,
    now: input.now,
    nameSuffix: input.nameSuffix,
  })

  return {
    markdown,
    suggestedName,
    markCount: marks.length,
    chapterCount: chapters.length,
  }
}

/** 从路径得到可读短书名：去扩展名、下载站尾巴，主标题（副标题前） */
export function bookTitleFromPath(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() ?? filePath
  let name = base.replace(/\.(epub|pdf|mobi|azw3|azw)$/i, '')

  // (z-library.sk, 1lib.sk, …) / （z-lib …）等下载站括注
  name = name.replace(
    /\s*[(\uff08][^)\uff09]*(?:z-?library|z-?lib|1lib|libgen|annas[- ]?archive|zlib)[^)\uff09]*[)\uff09]/gi,
    '',
  )
  // 残留的站点碎片
  name = name.replace(/\b(?:z-?library|1lib|z-?lib|libgen)[.\w-]*/gi, '')
  name = name.replace(/\s+/g, ' ').trim()
  name = name.replace(/[\s,，;；._-]+$/g, '').trim()

  // 「主标题：副标题」只取主标题，避免文件名过长
  const main = name.split(/[：:]/)[0]?.trim()
  return main || name || 'untitled'
}
