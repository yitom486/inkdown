import type { InkdownVirtualResource } from './inkdown-virtual-fs'

/**
 * 主进程能向渲染进程索取的内存快照。
 *
 * 虚拟文件资源都能当快照读；`search` 只走 MCP —— 它需要参数，
 * 没法表达成一个固定的 fs 路径。
 */
export type InkdownSnapshotResource =
  | InkdownVirtualResource
  | 'search'
  | 'selection'
  | 'chapter'
  | 'marks'
  | 'highlights'
  | 'create-bookmark'
  | 'create-note'
  | 'propose-note'
  | 'propose-mark'
  | 'suggest-chapters'

export interface InkdownSnapshotArgs {
  query?: string
  flatIndex?: number
  title?: string
  note?: string
  excerpt?: string
  kind?: 'highlight' | 'note' | 'auto'
  /** inkdown_list_marks：all | highlights | bookmarks */
  filter?: 'all' | 'highlights' | 'bookmarks'
  chapters?: Array<{
    flatIndex: number
    title: string
    reason: string
  }>
  marks?: Array<{
    excerpt: string
    note?: string
    flatIndex?: number
    kind?: 'highlight' | 'note' | 'auto'
  }>
}

/** 常规快照应在毫秒级返回 */
export const ACP_SNAPSHOT_TIMEOUT_MS = 5_000

/** 可能触发扫描 PDF 按需 OCR 的快照 */
export const ACP_SNAPSHOT_OCR_TIMEOUT_MS = 120_000

export function resolveSnapshotTimeoutMs(resource: InkdownSnapshotResource): number {
  switch (resource) {
    case 'viewport.txt':
    case 'chapter.txt':
    case 'chapter':
    case 'search':
      return ACP_SNAPSHOT_OCR_TIMEOUT_MS
    default:
      return ACP_SNAPSHOT_TIMEOUT_MS
  }
}
