import { isReaderDocumentKind } from '@shared/types/document'
import type { DocumentKind } from '@shared/types/document'
import { readingMarksApi } from '@/api/reading-marks-api'
import { isOk } from '@shared/core/result'
import {
  collectHighlightPassages,
  serializeMarkPassage,
} from '@/lib/reader/reading-mark-passages'
import { collectActiveDocument } from './collect-turn-context'
import { getReaderMarksProvider } from './reader-marks-registry'

export {
  collectHighlightPassages,
  isHighlightPassage,
  serializeMarkPassage as serializeMarkForAgent,
} from '@/lib/reader/reading-mark-passages'

function supportsInkdownMarks(kind: DocumentKind): boolean {
  return kind === 'web' || isReaderDocumentKind(kind)
}

async function loadMarksForOpenDocument() {
  const document = collectActiveDocument()
  if (!document?.path) {
    throw new Error('当前没有打开的文档')
  }
  if (!supportsInkdownMarks(document.kind)) {
    throw new Error('当前不是 EPUB/PDF/MOBI/在线文档，不必用 Inkdown 书签工具')
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
  marks: ReturnType<typeof serializeMarkPassage>[]
}> {
  const { document, marks } = await loadMarksForOpenDocument()
  return {
    documentPath: document.path,
    count: marks.length,
    marks: marks.map(serializeMarkPassage),
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
    noteCount: highlights.filter((item) => item.kind === 'note' || Boolean(item.note)).length,
    passages: highlights.map((item) => item.text),
    highlights,
  }
}

export async function createBookmarkForAgent(): Promise<ReturnType<typeof serializeMarkPassage>> {
  const provider = getReaderMarksProvider()
  if (!provider) {
    throw new Error('当前阅读器未就绪，无法创建书签')
  }
  const mark = await provider.createBookmark()
  return serializeMarkPassage(mark)
}

export {
  createNoteForAgent,
  proposeNoteForAgent,
} from '@/lib/agent/context/propose-note-for-agent'
