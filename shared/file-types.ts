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
