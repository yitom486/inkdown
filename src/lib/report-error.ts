import { toast } from 'sonner'
import { isCancelled, type AppError } from '@shared/errors'

/** 非 CANCELLED 错误统一以 Sonner Toast 提示 */
export function reportAppError(error: AppError): void {
  if (isCancelled(error)) return
  toast.error('操作失败', { description: error.message })
}

export function isAppError(value: unknown): value is AppError {
  return (
    value !== null &&
    typeof value === 'object' &&
    'code' in value &&
    'message' in value &&
    typeof (value as AppError).message === 'string'
  )
}

export function reportUnknownError(reason: unknown): void {
  if (isAppError(reason)) {
    reportAppError(reason)
    return
  }

  const message = reason instanceof Error ? reason.message : '发生未预期的错误'
  toast.error('发生未预期的错误', { description: message })
}
