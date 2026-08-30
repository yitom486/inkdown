/** 资源管理器路径与剪贴板辅助（纯函数，可单测） */

export function getParentDir(filePath: string): string {
  const trimmed = filePath.replace(/[/\\]+$/, '')
  const match = trimmed.match(/^(.*)[/\\][^/\\]+$/)
  return match?.[1] ?? trimmed
}

export function joinPath(parent: string, name: string): string {
  const sep = parent.includes('\\') && !parent.includes('/') ? '\\' : '/'
  if (parent.endsWith('/') || parent.endsWith('\\')) return `${parent}${name}`
  return `${parent}${sep}${name}`
}

export function getBaseName(filePath: string): string {
  const trimmed = filePath.replace(/[/\\]+$/, '')
  const parts = trimmed.split(/[/\\]/)
  return parts[parts.length - 1] ?? trimmed
}

export function toRelativePath(absolutePath: string, workspaceRoot: string): string {
  const root = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '')
  const file = absolutePath.replace(/\\/g, '/')
  if (file.toLowerCase() === root.toLowerCase()) return '.'
  const prefix = `${root}/`
  if (file.toLowerCase().startsWith(prefix.toLowerCase())) {
    return file.slice(prefix.length)
  }
  return absolutePath
}

export function isMarkdownPath(filePath: string): boolean {
  return /\.(md|markdown|txt)$/i.test(filePath)
}

export type TreeClipboardMode = 'copy' | 'cut'

export interface TreeClipboardEntry {
  mode: TreeClipboardMode
  path: string
  isDirectory: boolean
  name: string
}

export function resolvePasteTargetDir(
  target: { path: string; type: 'file' | 'directory' } | 'root',
  workspaceRoot: string,
): string {
  if (target === 'root') return workspaceRoot
  if (target.type === 'directory') return target.path
  return getParentDir(target.path)
}

export function buildUniqueChildPath(
  parentDir: string,
  desiredName: string,
  existingNamesLower: Set<string>,
): string {
  let name = desiredName
  if (existingNamesLower.has(name.toLowerCase())) {
    const dot = name.lastIndexOf('.')
    const hasExt = dot > 0
    const stem = hasExt ? name.slice(0, dot) : name
    const ext = hasExt ? name.slice(dot) : ''
    let i = 1
    while (existingNamesLower.has(name.toLowerCase())) {
      name = i === 1 ? `${stem} copy${ext}` : `${stem} copy ${i}${ext}`
      i += 1
    }
  }
  return joinPath(parentDir, name)
}

type TreeLike = {
  name: string
  path: string
  type: 'file' | 'directory' | string
  children?: TreeLike[]
}

function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

export function listChildNames(
  tree: TreeLike[],
  parentDir: string,
  workspaceRoot: string,
): Set<string> {
  const names = new Set<string>()
  const parentNorm = normPath(parentDir)
  const rootNorm = normPath(workspaceRoot)

  if (parentNorm === rootNorm) {
    for (const node of tree) names.add(node.name.toLowerCase())
    return names
  }

  const walk = (nodes: TreeLike[]): boolean => {
    for (const node of nodes) {
      if (node.type === 'directory' && normPath(node.path) === parentNorm) {
        for (const child of node.children ?? []) names.add(child.name.toLowerCase())
        return true
      }
      if (node.children && walk(node.children)) return true
    }
    return false
  }
  walk(tree)
  return names
}
