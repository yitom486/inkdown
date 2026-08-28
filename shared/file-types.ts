export interface OpenFileResult {
  filePath: string
  content: string
}

export interface SaveFilePayload {
  filePath?: string
  content: string
}

export interface SaveFileResult {
  filePath: string
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

export interface OpenFolderResult {
  rootPath: string
  tree: FileTreeNode[]
}
