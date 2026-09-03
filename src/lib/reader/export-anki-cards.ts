import type { ReadingMark } from '@shared/types/reading-mark'
import type { Flashcard } from '@shared/types/flashcard'
import {
  highlightSortKey,
  isHighlightPassage,
  passageExcerpt,
  passageNote,
} from '@/lib/reader/reading-mark-passages'
import {
  bookTitleFromPath,
  type ReadingNotesChapterRef,
  type ReadingNotesScope,
} from '@/lib/reader/export-reading-notes'
import { fileApi } from '@/api/file-api'
import { isOk } from '@shared/core/result'
import { reportAppError } from '@/lib/workspace/report-error'
import { buildDeepLinkUrl } from '@/lib/editor/deep-link'
import { toast } from 'sonner'

export interface BuildAnkiCardsExportInput {
  marks: ReadingMark[]
  toc: ReadingNotesChapterRef[]
  scope: ReadingNotesScope
  currentChapter?: ReadingNotesChapterRef | null
  bookTitle: string
  resolveChapter: (mark: ReadingMark, toc: ReadingNotesChapterRef[]) => ReadingNotesChapterRef
  now?: Date
  nameSuffix?: string
}

export interface BuildAnkiCardsExportResult {
  cards: Flashcard[]
  content: string
  suggestedName: string
  cardCount: number
}

function escapeAnkiHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** 规范化 Anki 标签（移除空格、冒号等不支持字符） */
export function sanitizeAnkiTag(name: string): string {
  return name
    .trim()
    .replace(/[\s:：#\t,，;；]+/g, '_')
    .replace(/^[_\-]+|[_\-]+$/g, '')
    .slice(0, 32)
}

function sanitizeFileNamePart(text: string, maxLen: number): string {
  const cleaned = text
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, maxLen)
}

function formatAnkiTimestamp(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}${m}${day}-${h}${min}`
}

export function buildAnkiExportFileName(
  bookTitle: string,
  scope: ReadingNotesScope,
  chapterLabel?: string | null,
  now = new Date(),
  suffix = '',
): string {
  const shortBook = sanitizeFileNamePart(bookTitle, 25) || 'book'
  const time = formatAnkiTimestamp(now)
  const tail = suffix ? `-${suffix}` : ''

  if (scope === 'chapter' && chapterLabel) {
    const shortChap = sanitizeFileNamePart(chapterLabel, 36) || 'chapter'
    return `${shortBook}：${shortChap}-anki-${time}${tail}.txt`
  }

  return `${shortBook}-anki-${time}${tail}.txt`
}

function cleanFieldForAnki(text: string): string {
  return text
    .replace(/\t/g, ' ')
    .replace(/\r?\n/g, '<br>')
}

/**
 * 转换 ReadingMark 列表为 Anki 标准卡片列表与 TSV 文本内容。
 */
export function buildAnkiCardsExport(
  input: BuildAnkiCardsExportInput,
): BuildAnkiCardsExportResult | null {
  const passages = input.marks
    .filter(isHighlightPassage)
    .sort((a, b) => highlightSortKey(a).localeCompare(highlightSortKey(b), 'en'))

  const filtered = passages.filter((mark) => {
    if (input.scope === 'chapter' && input.currentChapter) {
      const chap = input.resolveChapter(mark, input.toc)
      return chap.key === input.currentChapter.key || chap.matchKey === input.currentChapter.matchKey
    }
    return true
  })

  if (filtered.length === 0) {
    return null
  }

  const cards: Flashcard[] = []
  const bookTag = sanitizeAnkiTag(input.bookTitle)

  for (const mark of filtered) {
    const excerpt = passageExcerpt(mark).trim()
    const note = passageNote(mark).trim()
    if (!excerpt) continue

    const chapterRef = input.resolveChapter(mark, input.toc)
    const chapterTag = chapterRef.label ? sanitizeAnkiTag(chapterRef.label) : ''
    const tags = ['Inkdown']
    if (bookTag) tags.push(bookTag)
    if (chapterTag && chapterTag !== bookTag) tags.push(chapterTag)

    const bookFile = input.marks[0]?.filePath ? input.marks[0].filePath.split(/[/\\]/).pop() ?? input.bookTitle : input.bookTitle
    const deepLinkUrl = buildDeepLinkUrl({
      file: bookFile,
      page: mark.anchor?.format === 'pdf' ? mark.anchor.page : undefined,
      cfi: mark.anchor?.format === 'epub' ? mark.anchor.cfi : undefined,
      anchor: mark.id,
    })
    const linkHtml = ` <a href="${deepLinkUrl}" style="color:#10b981;text-decoration:none;margin-left:6px;">[📖 原书]</a>`

    const metaLine = `<div style="margin-top:8px;font-size:12px;color:#888;">—— 《${escapeAnkiHtml(
      input.bookTitle,
    )}》· ${escapeAnkiHtml(chapterRef.label || '正文')}${linkHtml}</div>`

    if (note) {
      // 问答卡（Basic）：批注为正面，原文为背面
      cards.push({
        id: mark.id,
        kind: 'basic',
        front: `<div style="font-size:15px;font-weight:600;">${escapeAnkiHtml(note)}</div>`,
        back: `<blockquote>${escapeAnkiHtml(excerpt)}</blockquote>${metaLine}`,
        tags,
        chapterName: chapterRef.label,
        sourceTitle: input.bookTitle,
      })
    } else {
      // 填空卡（Cloze）：原文为填空内容
      cards.push({
        id: mark.id,
        kind: 'cloze',
        front: `{{c1::${escapeAnkiHtml(excerpt)}}}`,
        back: metaLine,
        tags,
        chapterName: chapterRef.label,
        sourceTitle: input.bookTitle,
      })
    }
  }

  if (cards.length === 0) {
    return null
  }

  // 构造标准 Anki TSV/TXT 导出文件头
  const lines: string[] = [
    '#separator:tab',
    '#html:true',
    '#tags column:3',
  ]

  for (const card of cards) {
    const front = cleanFieldForAnki(card.front)
    const back = cleanFieldForAnki(card.back)
    const tagsStr = card.tags.join(' ')
    lines.push(`${front}\t${back}\t${tagsStr}`)
  }

  const content = lines.join('\n')
  const suggestedName = buildAnkiExportFileName(
    input.bookTitle,
    input.scope,
    input.currentChapter?.label,
    input.now,
    input.nameSuffix,
  )

  return {
    cards,
    content,
    suggestedName,
    cardCount: cards.length,
  }
}

/**
 * 调起文件保存对话框导出 Anki 记忆卡片。
 */
export async function saveAnkiCardsExport(options: {
  marks: ReadingMark[]
  toc: ReadingNotesChapterRef[]
  scope: ReadingNotesScope
  currentChapter?: ReadingNotesChapterRef | null
  filePath: string
  resolveChapter: (mark: ReadingMark, toc: ReadingNotesChapterRef[]) => ReadingNotesChapterRef
}): Promise<void> {
  const built = buildAnkiCardsExport({
    marks: options.marks,
    toc: options.toc,
    scope: options.scope,
    currentChapter: options.currentChapter,
    bookTitle: bookTitleFromPath(options.filePath),
    resolveChapter: options.resolveChapter,
  })

  if (!built) {
    toast.message('当前范围没有可导出的记忆卡片')
    return
  }

  const result = await fileApi.exportMarkdown({
    content: built.content,
    suggestedName: built.suggestedName,
    title: '导出 Anki 记忆卡片',
    filters: [
      { name: 'Anki 导入文件 (*.txt;*.tsv)', extensions: ['txt', 'tsv'] },
      { name: '所有文件 (*.*)', extensions: ['*'] },
    ],
  })

  if (!isOk(result)) {
    reportAppError(result.error)
    return
  }

  toast.success(`已成功导出 ${built.cardCount} 张 Anki 记忆卡片`)
}
