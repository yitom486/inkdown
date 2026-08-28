import { readdir } from 'fs/promises'
import { join, extname } from 'path'
import type { FileTreeNode } from '../shared/file-types'

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])

export async function scanWorkspace(
  dirPath: string,
  depth = 0,
): Promise<FileTreeNode[]> {
  if (depth > 6) return []

  const entries = await readdir(dirPath, { withFileTypes: true })
  const nodes: FileTreeNode[] = []

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of sorted) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

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
    if (!MARKDOWN_EXTENSIONS.has(extension)) continue

    nodes.push({
      name: entry.name,
      path: fullPath,
      type: 'file',
    })
  }

  return nodes
}
