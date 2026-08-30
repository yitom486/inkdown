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

export interface InkdownSnapshotArgs {
  query?: string
  flatIndex?: number
  title?: string
}
