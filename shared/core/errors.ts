export type AppErrorCode =
  | 'CANCELLED'
  | 'API_UNAVAILABLE'
  | 'FILE_READ_ERROR'
  | 'FILE_WRITE_ERROR'
  | 'FILE_NOT_FOUND'
  | 'WORKSPACE_SCAN_ERROR'
  | 'UNSUPPORTED_FORMAT'
  | 'ACP_SPAWN_ERROR'
  | 'ACP_PROTOCOL_ERROR'
  | 'ACP_NOT_CONNECTED'
  | 'ACP_TIMEOUT'
  | 'UNKNOWN'

export interface AppError {
  code: AppErrorCode
  message: string
}

export function isCancelled(error: AppError): boolean {
  return error.code === 'CANCELLED'
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return error as AppError
  }

  const message = error instanceof Error ? error.message : fallbackMessage
  const code: AppErrorCode =
    error instanceof Error && 'code' in error && error.code === 'ENOENT'
      ? 'FILE_NOT_FOUND'
      : 'UNKNOWN'

  return { code, message }
}
