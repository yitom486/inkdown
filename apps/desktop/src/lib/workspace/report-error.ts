import { reportRuntimeError } from '@/lib/workspace/error-reporter'

export { isAppError } from '@inkdown/contracts'
export { reportAppError } from '@/lib/workspace/error-reporter'

export function reportUnknownError(reason: unknown): void {
  reportRuntimeError(reason, { source: 'unknown' })
}
