import { MARKDOWN_EXTENSION_SET, READER_EXTENSION_SET } from '@shared/constants'

export type DocumentKind = 'markdown' | 'pdf' | 'epub' | 'unknown'

export type ReaderDocumentKind = Extract<DocumentKind, 'pdf' | 'epub'>

export function getFileExtension(filePath: string): string {
  const index = filePath.lastIndexOf('.')
  if (index === -1) return ''
  return filePath.slice(index).toLowerCase()
}

export function getDocumentKind(filePath: string): DocumentKind {
  const extension = getFileExtension(filePath)
  if (MARKDOWN_EXTENSION_SET.has(extension)) return 'markdown'
  if (extension === '.pdf') return 'pdf'
  if (extension === '.epub') return 'epub'
  return 'unknown'
}

export function isReaderDocumentKind(kind: DocumentKind): kind is ReaderDocumentKind {
  return kind === 'pdf' || kind === 'epub'
}

export function isWorkspaceFileExtension(extension: string): boolean {
  return MARKDOWN_EXTENSION_SET.has(extension) || READER_EXTENSION_SET.has(extension)
}
