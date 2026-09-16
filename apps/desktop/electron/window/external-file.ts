/**
 * 外部文件打开队列（资源管理器双击 / 打开方式 / macOS open-file）。
 *
 * 单实例应用收到文件路径时只入队，由渲染进程挂载后与窗口聚焦时取走——
 * 主进程不直接推送，避免“推送时 React 尚未挂载”导致打开请求丢失。
 * 文件合法性（存在且为普通文件）由入队方判定；类型是否可打开由渲染进程判定。
 */

export interface ExternalFileQueue {
  push(filePath: string): void
  take(): string | null
  size(): number
}

export function createExternalFileQueue(): ExternalFileQueue {
  const pending: string[] = []
  return {
    push(filePath: string): void {
      const trimmed = filePath.trim()
      if (!trimmed || pending.includes(trimmed)) return
      pending.push(trimmed)
    },
    take(): string | null {
      return pending.shift() ?? null
    },
    size(): number {
      return pending.length
    },
  }
}

/** 渲染进程各窗口共享的待处理外部文件队列 */
export const pendingExternalFiles = createExternalFileQueue()

/**
 * 命令行首个参数恒为可执行文件自身（调用方负责跳过）。
 * 过滤：空参数、开发目录标记、各类开关、协议链接（另走 deep-link 通道）。
 */
export function isExternalFileCandidate(arg: string): boolean {
  const trimmed = arg.trim()
  if (trimmed.length === 0 || trimmed === '.' || trimmed.startsWith('-')) return false
  if (trimmed.includes('://')) return false
  return true
}

/**
 * 从 Electron second-instance commandLine / process.argv 提取待打开文件。
 * isFile 注入便于单测；线上用 fs.existsSync + statSync 判定。
 */
export function extractExternalFilePaths(
  commandLine: readonly string[],
  isFile: (filePath: string) => boolean,
): string[] {
  const found: string[] = []
  for (const arg of commandLine.slice(1)) {
    if (!isExternalFileCandidate(arg)) continue
    let accepted = false
    try {
      accepted = isFile(arg)
    } catch {
      accepted = false
    }
    if (accepted && !found.includes(arg)) found.push(arg)
  }
  return found
}
