/**
 * 终端输出环形缓冲：按 UTF-8 字节上限从开头截断（落在码点边界）。
 */

export function truncateOutputFromStart(
  text: string,
  byteLimit: number,
): { text: string; truncated: boolean } {
  if (byteLimit <= 0) return { text: '', truncated: text.length > 0 }
  if (Buffer.byteLength(text, 'utf8') <= byteLimit) {
    return { text, truncated: false }
  }

  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (Buffer.byteLength(text.slice(mid), 'utf8') <= byteLimit) hi = mid
    else lo = mid + 1
  }
  return { text: text.slice(lo), truncated: true }
}

export function appendTerminalOutput(
  current: string,
  chunk: string,
  byteLimit: number,
): { output: string; truncated: boolean } {
  const { text, truncated } = truncateOutputFromStart(current + chunk, byteLimit)
  return { output: text, truncated }
}
