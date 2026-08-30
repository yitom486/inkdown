import { isReaderDocumentKind } from '@shared/types/document'
import { readingMarksApi } from '@/api/reading-marks-api'
import { isOk } from '@shared/core/result'
import type { ReadingAnchor, ReadingMark } from '@shared/types/reading-mark'
import { getReadingMarkKindLabel, getReadingMarkLabel } from '@/lib/reading-mark-labels'
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
    location: summarizeAnchor(mark.anchor),
    updatedAt: mark.updatedAt,
  }
}

export async function listMarksForAgent(): Promise<{
  documentPath: string
  count: number
  marks: ReturnType<typeof serializeMarkForAgent>[]
}> {
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

  return {
    documentPath: document.path,
    count: result.value.length,
    marks: result.value.map(serializeMarkForAgent),
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
