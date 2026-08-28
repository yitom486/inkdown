/** 阅读标记缓存键：路径 + 文件大小 */
export function buildReadingFileFingerprint(filePath: string, byteLength: number): string {
  return `${filePath.trim()}|${byteLength}`
}
