import type { DocumentKind } from '@shared/types/document'

export interface OpenFileResult {
  filePath: string
  content: string
}

export type OpenDocumentResult =
  | { filePath: string; kind: 'markdown'; content: string }
  | { filePath: string; kind: 'pdf' | 'epub' | 'mobi' }

export interface ReadBinaryResult {
  filePath: string
  /** IPC 传输后通常为 Uint8Array */
  data: Uint8Array
}

export interface OpenDialogOptions {
  defaultPath?: string
}

export interface SaveFilePayload {
  filePath?: string
  content: string
  /** 另存为对话框的初始路径（含文件名） */
  defaultPath?: string
}

export interface SaveFileResult {
  filePath: string
}

export interface ReadImageResult {
  dataUrl: string
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  /** 文件节点专用，用于侧栏图标区分 */
  documentKind?: Exclude<DocumentKind, 'unknown'>
  children?: FileTreeNode[]
}

export interface OpenFolderResult {
  rootPath: string
  tree: FileTreeNode[]
}

export interface SavePastedImagePayload {
  markdownFilePath: string
  base64: string
  mimeType: string
}

export interface SavePastedImageResult {
  relativePath: string
}

export interface ExportDocumentPayload {
  html: string
  suggestedName?: string
}

export interface ExportDocumentResult {
  filePath: string
}
