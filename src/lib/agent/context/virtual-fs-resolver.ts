import type {
  InkdownSnapshotArgs,
  InkdownSnapshotResource,
} from '@shared/agent/inkdown-snapshot'
import type { MarkProposalItem, MarkProposalKind, MarkProposalPayload } from '@shared/types/mark-proposal'
import { useReaderNavigationStore } from '@/stores/reader-navigation-store'
import { collectActiveDocument, collectReadingState } from './collect-turn-context'
import {
  readCurrentDocumentText,
  readViewportText,
} from './reader-content-registry'
import { readChapterByRef } from './read-chapter-by-ref'
import {
  createBookmarkForAgent,
  createNoteForAgent,
  listHighlightsForAgent,
  listMarksForAgent,
  proposeMarkAtForAgentResult,
} from './read-marks-for-agent'
import { readSelectionWithContext } from './read-selection-context'
import { searchReaderContent } from './search-reader-content'
import type { InkdownActiveDocument, InkdownReadingState } from './turn-context'

function parseMarkProposalArgs(args?: InkdownSnapshotArgs): MarkProposalPayload {
  const marksRaw = (args as { marks?: unknown } | undefined)?.marks
  const marks = Array.isArray(marksRaw)
    ? marksRaw
        .map((row): MarkProposalItem | null => {
          if (!row || typeof row !== 'object') return null
          const item = row as Record<string, unknown>
          const excerpt = typeof item.excerpt === 'string' ? item.excerpt.trim() : ''
          if (!excerpt) return null
          const kind =
            item.kind === 'highlight' || item.kind === 'note' || item.kind === 'auto'
              ? (item.kind as MarkProposalKind)
              : undefined
          return {
            excerpt,
            note: typeof item.note === 'string' ? item.note : undefined,
            flatIndex:
              typeof item.flatIndex === 'number' && Number.isFinite(item.flatIndex)
                ? item.flatIndex
                : undefined,
            kind,
          }
        })
        .filter((row): row is MarkProposalItem => row !== null)
    : undefined

  const kind =
    args?.kind === 'highlight' || args?.kind === 'note' || args?.kind === 'auto'
      ? args.kind
      : undefined

  return {
    excerpt: args?.excerpt,
    note: args?.note,
    flatIndex: args?.flatIndex,
    kind,
    marks: marks?.length ? marks : undefined,
  }
}

/** 目录条目上限：整本书目录再大也不该一次灌满 Agent 上下文 */
export const TOC_ENTRY_LIMIT = 600

export interface InkdownTocEntry {
  index: number
  level: number
  label: string
}

export interface InkdownTocSnapshot {
  document: InkdownActiveDocument | null
  format: string | null
  unitCount: number
  /** 当前所在条目下标，未知为 -1 */
  currentIndex: number
  truncated: boolean
  entries: InkdownTocEntry[]
}

export interface InkdownFocusedSnapshot {
  activeDocument: InkdownActiveDocument | null
  reading?: InkdownReadingState
}

interface TocSourceUnit {
  label: string
  level?: number
}

export function buildTocEntries(
  units: readonly TocSourceUnit[],
  limit = TOC_ENTRY_LIMIT,
): { entries: InkdownTocEntry[]; truncated: boolean } {
  const entries = units.slice(0, limit).map((unit, index) => ({
    index,
    level: unit.level ?? 0,
    label: unit.label,
  }))
  return { entries, truncated: units.length > limit }
}

function buildTocSnapshot(): InkdownTocSnapshot {
  const document = collectActiveDocument()
  const reader = useReaderNavigationStore.getState()
  const sameFile = Boolean(document) && reader.filePath === document?.path

  if (!sameFile || !reader.ready) {
    return {
      document,
      format: null,
      unitCount: 0,
      currentIndex: -1,
      truncated: false,
      entries: [],
    }
  }

  const { entries, truncated } = buildTocEntries(reader.units)
  return {
    document,
    format: reader.format,
    unitCount: reader.units.length,
    currentIndex: reader.nav.flatIndex,
    truncated,
    entries,
  }
}

function buildFocusedSnapshot(): InkdownFocusedSnapshot {
  const activeDocument = collectActiveDocument()
  return { activeDocument, reading: collectReadingState(activeDocument) }
}

/**
 * 把快照资源序列化成 Agent 能直接读的文本。
 * 全部取自渲染进程内存，不重新解析文件、不落盘。
 */
export async function resolveInkdownSnapshot(
  resource: InkdownSnapshotResource,
  args?: InkdownSnapshotArgs,
): Promise<string> {
  switch (resource) {
    case 'toc.json':
      return JSON.stringify(buildTocSnapshot(), null, 2)
    case 'focused.json':
      return JSON.stringify(buildFocusedSnapshot(), null, 2)
    case 'chapter.txt':
      return await readCurrentDocumentText()
    case 'viewport.txt':
      return await readViewportText()
    case 'search':
      return JSON.stringify(await searchReaderContent(args?.query ?? ''), null, 2)
    case 'selection':
      return JSON.stringify(await readSelectionWithContext(), null, 2)
    case 'chapter':
      return JSON.stringify(
        await readChapterByRef({
          flatIndex: args?.flatIndex,
          title: args?.title,
        }),
        null,
        2,
      )
    case 'marks':
      return JSON.stringify(await listMarksForAgent(), null, 2)
    case 'highlights':
      return JSON.stringify(await listHighlightsForAgent(), null, 2)
    case 'create-bookmark':
      return JSON.stringify(await createBookmarkForAgent(), null, 2)
    case 'create-note':
    case 'propose-note':
      return JSON.stringify(await createNoteForAgent(args?.note ?? ''), null, 2)
    case 'propose-mark':
      return JSON.stringify(
        await proposeMarkAtForAgentResult(parseMarkProposalArgs(args)),
        null,
        2,
      )
  }
}
