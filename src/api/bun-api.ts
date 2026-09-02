import type { BunRuntimeStatus } from '@shared/types/bun'
import type { AppError } from '@shared/core/errors'
import type { Result } from '@shared/core/result'

function api() {
  if (!window.electronAPI) {
    throw new Error('electronAPI 不可用')
  }
  return window.electronAPI
}

export function getBunRuntimeStatus(): Promise<Result<BunRuntimeStatus, AppError>> {
  return api().getBunRuntimeStatus()
}

export function installBunRuntime(): Promise<Result<void, AppError>> {
  return api().installBunRuntime()
}
