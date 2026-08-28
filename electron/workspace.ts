import { readdir } from 'fs/promises'
import { join, extname } from 'path'
import {
  MARKDOWN_EXTENSION_SET,
  WORKSPACE_IGNORED_DIR_NAMES,
  WORKSPACE_MAX_DEPTH,
} from '@shared/constants'
import type { FileTreeNode } from '@shared/file-types'

export async function scanWorkspace(
  dirPath: string,
  depth = 0,
): Promise<FileTreeNode[]> {
  if (depth > WORKSPACE_MAX_DEPTH) return []

  const entries = await readdir(dirPath, { withFileTypes: true })
  const nodes: FileTreeNode[] = []

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of sorted) {
    if (entry.name.startsWith('.') || WORKSPACE_IGNORED_DIR_NAMES.has(entry.name)) continue

    const fullPath = join(dirPath, entry.name)

    if (entry.isDirectory()) {
      const children = await scanWorkspace(fullPath, depth + 1)
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children,
      })
      continue
    }

    if (!entry.isFile()) continue

    const extension = extname(entry.name).toLowerCase()
    if (!MARKDOWN_EXTENSION_SET.has(extension)) continue

    nodes.push({
      name: entry.name,
      path: fullPath,
      type: 'file',
    })
  }

  return nodes
}
