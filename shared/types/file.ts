/**
 * 文件 / 工作区 / 导出 IPC DTO。
 * 打开结果用 kind 判别：Markdown 带正文，电子书只给路径（内容在阅读器里读）。
 */
import type { DocumentKind } from '@shared/types/document'

/** 按路径读文本（已知是 Markdown/纯文本） */
export interface OpenFileResult {
  filePath: string
  content: string
}

/** 打开对话框的结果：markdown 含 content；pdf/epub/mobi 不含，避免把二进制当字符串 */
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
  /** Markdown 旁 assets/；与 workspaceRoot 二选一 */
  markdownFilePath?: string
  /** Agent 粘贴：落到 workspace/.inkdown/agent-pasted/ */
  workspaceRoot?: string
  base64: string
  mimeType: string
}

export interface SavePastedImageResult {
  relativePath: string
  absolutePath: string
}

export interface ExportDocumentPayload {
  html: string
  suggestedName?: string
}

/** 另存为 Markdown / 纯文本（笔记导出、Anki 卡片等） */
export interface ExportMarkdownPayload {
  content: string
  suggestedName?: string
  title?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

export interface ExportDocumentResult {
  filePath: string
}

/** 工作区树操作成功后的绝对路径 */
export interface WorkspaceFsPathResult {
  path: string
}

export interface WorkspaceFsCreateFilePayload {
  workspaceRoot: string
  path: string
  content?: string
}

export interface WorkspaceFsCreateDirPayload {
  workspaceRoot: string
  path: string
}

export interface WorkspaceFsRenamePayload {
  workspaceRoot: string
  fromPath: string
  toPath: string
}

export interface WorkspaceFsDeletePayload {
  workspaceRoot: string
  path: string
}

export interface WorkspaceFsCopyPayload {
  workspaceRoot: string
  fromPath: string
  toPath: string
}

export interface WorkspaceFsMovePayload {
  workspaceRoot: string
  fromPath: string
  toPath: string
}
