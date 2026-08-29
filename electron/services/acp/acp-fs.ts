import { access, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { mkdir } from 'node:fs/promises'

const MAX_READ_BYTES = 2 * 1024 * 1024

export function assertPathInsideWorkspace(filePath: string, workspaceRoot: string): string {
  const root = resolve(workspaceRoot)
  const target = resolve(filePath)
  const rootWithSep = root.endsWith(sep) ? root : root + sep
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`路径不在工作区内: ${filePath}`)
  }
  return target
}

export async function acpReadTextFile(params: {
  path: string
  workspaceRoot: string
  line?: number
  limit?: number
}): Promise<{ content: string }> {
  const abs = assertPathInsideWorkspace(params.path, params.workspaceRoot)
  await access(abs)
  let content = await readFile(abs, 'utf-8')
  if (Buffer.byteLength(content, 'utf-8') > MAX_READ_BYTES) {
    content = content.slice(0, Math.floor(MAX_READ_BYTES / 2))
    content += '\n\n…[截断：文件过大]…'
  }

  if (typeof params.line === 'number' && params.line > 0) {
    const lines = content.split('\n')
    const start = params.line - 1
    const limit = typeof params.limit === 'number' && params.limit > 0 ? params.limit : lines.length
    content = lines.slice(start, start + limit).join('\n')
  }

  return { content }
}

export async function acpWriteTextFile(params: {
  path: string
  content: string
  workspaceRoot: string
}): Promise<Record<string, never>> {
  const abs = assertPathInsideWorkspace(params.path, params.workspaceRoot)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, params.content, 'utf-8')
  return {}
}
