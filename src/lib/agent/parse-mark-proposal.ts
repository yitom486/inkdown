import type { MarkProposalToolResult, ProposedMark } from '@shared/types/mark-proposal'
import { toProposedMark } from '@shared/types/mark-proposal'

const PROPOSE_TOOL_PATTERN =
  /inkdown_(?:propose_note|create_note|propose_mark|create_mark)|propose.?note|create.?note|提议批注|批注草稿/i

export function isProposeMarkToolTitle(title: string | undefined): boolean {
  if (!title?.trim()) return false
  return PROPOSE_TOOL_PATTERN.test(title)
}

export function parseMarkProposalToolResult(text: string): MarkProposalToolResult | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const row = JSON.parse(trimmed) as Record<string, unknown>
    if (row.proposed !== true) return null
    return {
      proposed: true,
      note: typeof row.note === 'string' ? row.note : '',
      excerpt: typeof row.excerpt === 'string' ? row.excerpt : '',
      message: typeof row.message === 'string' ? row.message : '',
    }
  } catch {
    return null
  }
}

export function parseMarkProposalFromTool(
  toolTitle: string | undefined,
  toolContentText: string | undefined,
  toolCallId?: string,
): ProposedMark | null {
  const parsed = parseMarkProposalToolResult(toolContentText ?? '')
  if (parsed) {
    return toProposedMark({
      id: toolCallId ? `tool:${toolCallId}` : undefined,
      excerpt: parsed.excerpt,
      note: parsed.note,
      source: 'agent',
    })
  }
  if (!isProposeMarkToolTitle(toolTitle)) return null
  return null
}

export function enrichToolMessageWithMarkProposal<
  T extends {
    role: string
    toolTitle?: string
    toolContentText?: string
    text?: string
    toolCallId?: string
    toolStatus?: string
    streaming?: boolean
    markProposal?: ProposedMark
    markProposalStatus?: import('@shared/types/mark-proposal').MarkProposalStatus
  },
>(message: T, isActiveStatus: (status: string | undefined) => boolean): T {
  if (message.role !== 'tool' || message.markProposal) return message
  if (message.streaming || isActiveStatus(message.toolStatus)) return message
  const proposal = parseMarkProposalFromTool(
    message.toolTitle,
    message.toolContentText ?? message.text,
    message.toolCallId,
  )
  if (!proposal) return message
  return {
    ...message,
    markProposal: proposal,
    markProposalStatus: message.markProposalStatus ?? 'pending',
  }
}
