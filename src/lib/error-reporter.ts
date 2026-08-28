import { toast } from 'sonner'
import { appApi } from '@/api/app-api'
import { useErrorLogStore } from '@/stores/error-log-store'
import { isAppError, reportAppError } from '@/lib/report-error'
import type { RendererErrorPayload } from '@shared/error-log-types'

export interface RuntimeErrorContext {
  source: string
  filePath?: string
  componentStack?: string
  /** 仅写入日志，不弹 Toast（用于已展示 fallback UI 的边界） */
  silentToast?: boolean
  level?: RendererErrorPayload['level']
}

let lastToastKey = ''
let lastToastAt = 0

function normalizeError(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) {
    return { message: reason.message || reason.name, stack: reason.stack }
  }
  if (typeof reason === 'string') {
    return { message: reason }
  }
  try {
    return { message: JSON.stringify(reason) }
  } catch {
    return { message: String(reason) }
  }
}

function shouldShowToast(source: string, message: string, silentToast?: boolean): boolean {
  if (silentToast) return false

  const key = `${source}:${message}`
  const now = Date.now()
  if (key === lastToastKey && now - lastToastAt < 3000) {
    return false
  }

  lastToastKey = key
  lastToastAt = now
  return true
}

export function reportRuntimeError(reason: unknown, context: RuntimeErrorContext): void {
  if (isAppError(reason)) {
    reportAppError(reason)
    return
  }

  const { message, stack } = normalizeError(reason)
  const entry: RendererErrorPayload = {
    timestamp: new Date().toISOString(),
    level: context.level ?? 'error',
    source: context.source,
    message,
    stack,
    componentStack: context.componentStack,
    filePath: context.filePath,
  }

  useErrorLogStore.getState().addEntry(entry)
  console.error(`[${context.source}]`, reason, context.componentStack ?? '')

  void appApi.logRendererError(entry)

  if (shouldShowToast(context.source, message, context.silentToast)) {
    toast.error('运行出错', {
      description: `[${context.source}] ${message}`,
      duration: 8000,
    })
  }
}

export function formatErrorLogEntry(entry: RendererErrorPayload): string {
  const lines = [
    `[${entry.timestamp}] ${entry.level.toUpperCase()} · ${entry.source}`,
    entry.message,
  ]
  if (entry.filePath) lines.push(`file: ${entry.filePath}`)
  if (entry.stack) lines.push(entry.stack)
  if (entry.componentStack) lines.push(entry.componentStack)
  return lines.join('\n')
}
