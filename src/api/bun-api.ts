import type { BunRuntimeStatus } from '@inkdown/contracts'
import type { AppError } from '@inkdown/contracts'
import type { Result } from '@inkdown/contracts'

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
