/** ACP session/request_permission 选项解析（兼容 optionId / id） */

export interface AcpPermissionOptionView {
  optionId: string
  name: string
  kind: string
}

export function parsePermissionOptions(raw: unknown): AcpPermissionOptionView[] {
  if (!Array.isArray(raw)) return []
  const out: AcpPermissionOptionView[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const optionId =
      typeof row.optionId === 'string'
        ? row.optionId
        : typeof row.id === 'string'
          ? row.id
          : ''
    if (!optionId) continue
    const kind = typeof row.kind === 'string' ? row.kind : ''
    const name =
      typeof row.name === 'string'
        ? row.name
        : typeof row.title === 'string'
          ? row.title
          : optionId
    out.push({ optionId, name, kind })
  }
  return out
}

export function isAllowPermissionKind(kind: string): boolean {
  return kind === 'allow_once' || kind === 'allow_always' || kind.includes('allow')
}

export function isRejectPermissionKind(kind: string): boolean {
  return kind === 'reject_once' || kind === 'reject_always' || kind.includes('reject')
}

export function pickDefaultAllowOption(
  options: AcpPermissionOptionView[],
): AcpPermissionOptionView | undefined {
  return (
    options.find((o) => o.kind === 'allow_once') ??
    options.find((o) => isAllowPermissionKind(o.kind)) ??
    options[0]
  )
}

export function pickDefaultRejectOption(
  options: AcpPermissionOptionView[],
): AcpPermissionOptionView | undefined {
  return (
    options.find((o) => o.kind === 'reject_once') ??
    options.find((o) => isRejectPermissionKind(o.kind))
  )
}

export function permissionSummaryFromToolCall(
  toolCall: Record<string, unknown> | undefined,
  fallback = 'Agent 请求执行工具',
): string {
  if (!toolCall) return fallback
  if (typeof toolCall.title === 'string' && toolCall.title.trim()) return toolCall.title
  if (typeof toolCall.name === 'string' && toolCall.name.trim()) return toolCall.name
  return fallback
}

export function toolCallIdFromPermission(
  toolCall: Record<string, unknown> | undefined,
): string | undefined {
  if (!toolCall) return undefined
  if (typeof toolCall.toolCallId === 'string') return toolCall.toolCallId
  if (typeof toolCall.tool_call_id === 'string') return toolCall.tool_call_id
  if (typeof toolCall.id === 'string') return toolCall.id
  return undefined
}
