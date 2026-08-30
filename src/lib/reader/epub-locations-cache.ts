/** 用于 locations 缓存失效：同路径 + 文件大小一致则视为同一文件 */
export function buildEpubFileFingerprint(filePath: string, byteLength: number): string {
  return `${filePath.trim()}|${byteLength}`
}

export const EPUB_LOCATIONS_CHUNK_SIZE = 800
