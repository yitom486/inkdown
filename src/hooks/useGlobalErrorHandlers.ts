import { useEffect } from 'react'
import { reportUnknownError } from '@/lib/report-error'

/** 捕获未处理的 Promise 拒绝，避免静默失败 */
export function useGlobalErrorHandlers(): void {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[unhandledrejection]', event.reason)
      reportUnknownError(event.reason)
      event.preventDefault()
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }, [])
}
