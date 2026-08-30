import type { InkdownVirtualResource } from '@shared/agent/inkdown-virtual-fs'
import { useReaderNavigationStore } from '@/stores/reader-navigation-store'
import { collectActiveDocument, collectReadingState } from './collect-turn-context'
import type { InkdownActiveDocument, InkdownReadingState } from './turn-context'

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
 * 把虚拟资源序列化成 Agent 能直接读的文本。
 * 全部取自渲染进程内存，不重新解析文件、不落盘。
 */
export function resolveInkdownVirtualResource(resource: InkdownVirtualResource): string {
  switch (resource) {
    case 'toc.json':
      return JSON.stringify(buildTocSnapshot(), null, 2)
    case 'focused.json':
      return JSON.stringify(buildFocusedSnapshot(), null, 2)
  }
}
