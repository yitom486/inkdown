/** 跨进程可用的轻量路径工具（不依赖 Node path） */

export function dirname(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (index <= 0) return filePath
  return filePath.slice(0, index)
}

export function joinPath(dir: string, fileName: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.endsWith(sep) || dir.endsWith('/') || dir.endsWith('\\')
    ? `${dir}${fileName}`
    : `${dir}${sep}${fileName}`
}
