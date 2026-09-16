import { acpDevLog, acpDevWarn } from '@/lib/agent/acp-dev-log'

export type MarkProposalPhase =
  | 'snapshot:start'
  | 'snapshot:ok'
  | 'snapshot:fail'
  | 'propose:unified'
  | 'propose:resolve'
  | 'propose:done'
  | 'adopt:start'
  | 'adopt:path'
  | 'adopt:createMarkAt'
  | 'adopt:done'
  | 'adopt:fail'
  | 'match:text'
  | 'match:dom'

function summarizeText(text: string | undefined, max = 72): string | undefined {
  if (text === undefined) return undefined
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return '(empty)'
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…(${trimmed.length})`
}

export function markProposalDevLog(
  phase: MarkProposalPhase,
  data?: Record<string, unknown>,
): void {
  acpDevLog(`mark-proposal ${phase}`, data)
}

export function markProposalDevFail(
  phase: MarkProposalPhase,
  error: unknown,
  data?: Record<string, unknown>,
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  acpDevWarn(`mark-proposal ${phase}`, {
    ...data,
    errorName: err.name,
    errorMessage: err.message,
    errorStack: err.stack,
  })
}

export function markProposalArgPreview(args?: {
  excerpt?: string
  note?: string
  flatIndex?: number
  kind?: string
  marks?: unknown[]
}): Record<string, unknown> {
  return {
    excerpt: summarizeText(args?.excerpt),
    note: summarizeText(args?.note),
    flatIndex: args?.flatIndex,
    kind: args?.kind,
    marksCount: Array.isArray(args?.marks) ? args.marks.length : undefined,
  }
}

export { summarizeText as markProposalTextPreview }
