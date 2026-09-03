import { MARKDOWN_EXTENSION_SET, READER_EXTENSION_SET } from '@shared/constants/extensions'

/** 当前打开内容的种类；web 用 http(s) URL 当 path，不是磁盘扩展名 */
export type DocumentKind = 'markdown' | 'pdf' | 'epub' | 'mobi' | 'web' | 'unknown'

/** 走阅读器而不是 Markdown 编辑器的本地电子书 */
export type ReaderDocumentKind = Extract<DocumentKind, 'pdf' | 'epub' | 'mobi'>

export function isWebDocumentPath(path: string): boolean {
  try {
    const url = new URL(path)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function getFileExtension(filePath: string): string {
  const index = filePath.lastIndexOf('.')
  if (index === -1) return ''
  return filePath.slice(index).toLowerCase()
}

export function getDocumentKind(filePath: string): DocumentKind {
  if (isWebDocumentPath(filePath)) return 'web'
  const extension = getFileExtension(filePath)
  if (MARKDOWN_EXTENSION_SET.has(extension)) return 'markdown'
  if (extension === '.pdf') return 'pdf'
  if (extension === '.epub') return 'epub'
  if (extension === '.mobi' || extension === '.azw3' || extension === '.azw') return 'mobi'
  return 'unknown'
}

export function isReaderDocumentKind(kind: DocumentKind): kind is ReaderDocumentKind {
  return kind === 'pdf' || kind === 'epub' || kind === 'mobi'
}

/** 工作区侧栏是否展示该扩展名（Markdown + 阅读器格式） */
export function isWorkspaceFileExtension(extension: string): boolean {
  return MARKDOWN_EXTENSION_SET.has(extension) || READER_EXTENSION_SET.has(extension)
}
