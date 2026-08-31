import { toProposedMark } from '@shared/types/mark-proposal'
import type { MarkProposalStatus, ProposedMark } from '@shared/types/mark-proposal'
import type { AcpChatMessage } from '@/stores/acp-chat-types'
import { useAnnotationAgentStore } from '@/stores/annotation-agent-store'

export interface ChatMarkProposal {
  proposal: ProposedMark
  status: MarkProposalStatus
  toolCallId?: string
}

export function isPendingMarkProposalEntry(entry: ChatMarkProposal): boolean {
  return entry.status === 'pending'
}

export function isProposalPromotedToAgent(
  messages: AcpChatMessage[],
  proposalId: string,
): boolean {
  return messages.some(
    (message) =>
      message.role === 'agent' &&
      message.markProposals?.some((row) => row.proposal.id === proposalId),
  )
}

export function shouldHideProposeToolMessage(message: AcpChatMessage): boolean {
  return message.role === 'tool' && Boolean(message.markProposal)
}

function mergeProposals(
  existing: ChatMarkProposal[] | undefined,
  incoming: ChatMarkProposal[],
): ChatMarkProposal[] {
  const merged = [...(existing ?? [])]
  for (const item of incoming) {
    if (merged.some((row) => row.proposal.id === item.proposal.id)) continue
    merged.push(item)
  }
  return merged
}

function collectToolProposals(messages: AcpChatMessage[]): ChatMarkProposal[] {
  const rows: ChatMarkProposal[] = []
  for (const message of messages) {
    if (message.role !== 'tool' || !message.markProposal) continue
    if (message.markProposalStatus === 'dismissed') continue
    rows.push({
      proposal: message.markProposal,
      status: message.markProposalStatus ?? 'pending',
      toolCallId: message.toolCallId,
    })
  }
  return rows
}

function collectStoreFallbackProposal(): ChatMarkProposal | null {
  const store = useAnnotationAgentStore.getState()
  if (store.proposeHost !== 'main-agent' || !store.pendingDraft) return null
  const draft = store.pendingDraft
  return {
    proposal: toProposedMark({
      id: `main:${draft.fileKey}`,
      excerpt: draft.excerpt,
      note: draft.note,
      source: 'agent',
    }),
    status: 'pending',
  }
}

/** 回合结束时：把工具 propose 挂到最近一条 Agent 回复下方（内嵌块数据源）。 */
export function promoteMarkProposalsToLastAgent(
  messages: AcpChatMessage[],
): AcpChatMessage[] {
  const fromTools = collectToolProposals(messages)
  const fallback = collectStoreFallbackProposal()
  const incoming = fallback
    ? mergeProposals([], [...fromTools, fallback])
    : fromTools
  if (incoming.length === 0) return messages

  let lastAgentIdx = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!
    if (message.role === 'agent' && !message.streaming && message.text.trim()) {
      lastAgentIdx = i
      break
    }
  }
  if (lastAgentIdx < 0) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'agent' && !messages[i]?.streaming) {
        lastAgentIdx = i
        break
      }
    }
  }
  if (lastAgentIdx < 0) return messages

  return messages.map((message, idx) =>
    idx === lastAgentIdx
      ? { ...message, markProposals: mergeProposals(message.markProposals, incoming) }
      : message,
  )
}

export function resolveMarkProposalOnMessages(
  messages: AcpChatMessage[],
  proposalId: string,
  status: Exclude<MarkProposalStatus, 'pending'>,
): AcpChatMessage[] {
  return messages.map((message) => {
    let next = message
    if (message.markProposals?.some((row) => row.proposal.id === proposalId)) {
      next = {
        ...next,
        markProposals: message.markProposals.map((row) =>
          row.proposal.id === proposalId ? { ...row, status } : row,
        ),
      }
    }
    if (
      message.role === 'tool' &&
      message.markProposal?.id === proposalId
    ) {
      next = { ...next, markProposalStatus: status }
    }
    return next
  })
}
