import { isReaderDocumentKind } from '@shared/types/document'
import { readingMarksApi } from '@/api/reading-marks-api'
import { isOk } from '@shared/core/result'
import type { ReadingAnchor, ReadingMark } from '@shared/types/reading-mark'
import { getReadingMarkKindLabel, getReadingMarkLabel } from '@/lib/reading-mark-labels'
import { normalizeHighlightColor } from '@/lib/reading-mark-colors'
import { collectActiveDocument } from './collect-turn-context'
import { getReaderMarksProvider } from './reader-marks-registry'

function summarizeAnchor(anchor: ReadingAnchor): string {
  switch (anchor.format) {
    case 'pdf':
      return `第 ${anchor.page} 页`
    case 'epub':
      return anchor.href ?? anchor.cfi.slice(0, 48)
    case 'mobi':
      return `章节 ${anchor.chapterId}`
  }
}

export function serializeMarkForAgent(mark: ReadingMark) {
  return {
    id: mark.id,
    kind: mark.kind,
    kindLabel: getReadingMarkKindLabel(mark.kind),
    label: getReadingMarkLabel(mark),
    excerpt: mark.excerpt ?? mark.anchor.selectedText ?? null,
    note: mark.note ?? null,
    color: mark.kind === 'bookmark' ? null : normalizeHighlightColor(mark.color),
    location: summarizeAnchor(mark.anchor),
    updatedAt: mark.updatedAt,
  }
}

/** 划重点：高亮原文，以及带摘录的批注（批注也是划过的重点） */
export function isHighlightPassage(mark: ReadingMark): boolean {
  if (mark.kind === 'bookmark') return false
  const text = (mark.excerpt ?? mark.anchor.selectedText ?? '').trim()
  if (!text) return false
  return mark.kind === 'highlight' || mark.kind === 'note'
}

function highlightSortKey(mark: ReadingMark): string {
  switch (mark.anchor.format) {
    case 'pdf':
      return `pdf:${String(mark.anchor.page).padStart(6, '0')}:${mark.createdAt}`
    case 'epub':
      return `epub:${mark.anchor.href ?? mark.anchor.cfi}:${mark.createdAt}`
    case 'mobi':
      return `mobi:${mark.anchor.chapterId}:${mark.createdAt}`
  }
}

export function collectHighlightPassages(marks: ReadingMark[]) {
  return marks
    .filter(isHighlightPassage)
    .sort((a, b) => highlightSortKey(a).localeCompare(highlightSortKey(b), 'en'))
    .map((mark) => ({
      ...serializeMarkForAgent(mark),
      text: (mark.excerpt ?? mark.anchor.selectedText ?? '').trim(),
    }))
}

async function loadMarksForOpenDocument() {
  const document = collectActiveDocument()
  if (!document?.path) {
    throw new Error('当前没有打开的文档')
  }
  if (!isReaderDocumentKind(document.kind)) {
    throw new Error('当前不是 EPUB/PDF/MOBI，不必用 Inkdown 书签工具')
  }

  const result = await readingMarksApi.list(document.path)
  if (!isOk(result)) {
    throw new Error(result.error.message || '读取书签失败')
  }

  return { document, marks: result.value }
}

export async function listMarksForAgent(): Promise<{
  documentPath: string
  count: number
  marks: ReturnType<typeof serializeMarkForAgent>[]
}> {
  const { document, marks } = await loadMarksForOpenDocument()
  return {
    documentPath: document.path,
    count: marks.length,
    marks: marks.map(serializeMarkForAgent),
  }
}

export async function listHighlightsForAgent(): Promise<{
  documentPath: string
  count: number
  highlightCount: number
  noteCount: number
  passages: string[]
  highlights: ReturnType<typeof collectHighlightPassages>
}> {
  const { document, marks } = await loadMarksForOpenDocument()
  const highlights = collectHighlightPassages(marks)
  return {
    documentPath: document.path,
    count: highlights.length,
    highlightCount: highlights.filter((item) => item.kind === 'highlight').length,
    noteCount: highlights.filter((item) => item.kind === 'note').length,
    passages: highlights.map((item) => item.text),
    highlights,
  }
}

export async function createBookmarkForAgent(): Promise<ReturnType<typeof serializeMarkForAgent>> {
  const provider = getReaderMarksProvider()
  if (!provider) {
    throw new Error('当前阅读器未就绪，无法创建书签')
  }
  const mark = await provider.createBookmark()
  return serializeMarkForAgent(mark)
}

export async function createNoteForAgent(
  note: string,
): Promise<ReturnType<typeof serializeMarkForAgent>> {
  const provider = getReaderMarksProvider()
  if (!provider) {
    throw new Error('当前阅读器未就绪，无法创建批注')
  }
  const mark = await provider.createNoteFromSelection(note.trim())
  return serializeMarkForAgent(mark)
}
