import { initKf8File, initMobiFile, type Kf8, type Mobi } from '@lingo-reader/mobi-parser'
import { getFileExtension } from '@shared/types/document'

export type KindleBook = Mobi | Kf8

const KF8_EXTENSIONS = new Set(['.azw3', '.azw'])

export function isKf8KindleExtension(filePath: string): boolean {
  return KF8_EXTENSIONS.has(getFileExtension(filePath))
}

/**
 * 双格式 .mobi 内嵌 KF8 正文；用经典 pagebreak 解析只会得到 XML 脏切片。
 * mobi-parser 对此会 warn：应改用 KF8 解析器（与 .azw3 相同）。
 */
export async function initDualFormatMobiFile(data: Uint8Array): Promise<KindleBook> {
  try {
    const kf8 = await initKf8File(data)
    if (kf8.getSpine().length > 0) {
      return kf8
    }
    kf8.destroy()
  } catch {
    // 纯经典 MOBI 无 FDST，回退 pagebreak 解析
  }
  return initMobiFile(data)
}

/** 按扩展名与内嵌格式选择 MOBI 或 KF8 解析器 */
export async function initKindleFile(data: Uint8Array, filePath: string): Promise<KindleBook> {
  if (isKf8KindleExtension(filePath)) {
    return initKf8File(data)
  }
  return initDualFormatMobiFile(data)
}
