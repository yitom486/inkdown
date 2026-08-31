import { describe, expect, it } from 'vitest'
import { promoteMarkProposalsToLastAgent, isProposalPromotedToAgent } from '@/lib/agent/promote-mark-proposals'
import type { AcpChatMessage } from '@/stores/acp-chat-types'
import { toProposedMark } from '@shared/types/mark-proposal'

describe('promote-mark-proposals', () => {
  it('把工具 propose 挂到最近 Agent 回复下方', () => {
    const proposal = toProposedMark({ excerpt: '原文', note: '批注', source: 'agent' })
    const messages: AcpChatMessage[] = [
      { id: 'u1', role: 'user', text: '写批注', createdAt: 1 },
      {
        id: 't1',
        role: 'tool',
        text: '{}',
        createdAt: 2,
        toolCallId: 'tc1',
        markProposal: proposal,
        markProposalStatus: 'pending',
      },
      { id: 'a1', role: 'agent', text: '已整理草稿', createdAt: 3 },
    ]
    const next = promoteMarkProposalsToLastAgent(messages)
    const agent = next.find((m) => m.id === 'a1')
    expect(agent?.markProposals).toHaveLength(1)
    expect(agent?.markProposals?.[0]?.proposal.note).toBe('批注')
  })

  it('isProposalPromotedToAgent 检测已挂载', () => {
    const proposal = toProposedMark({ id: 'p1', excerpt: '', note: 'x', source: 'agent' })
    const messages: AcpChatMessage[] = [
      {
        id: 'a1',
        role: 'agent',
        text: 'ok',
        createdAt: 1,
        markProposals: [{ proposal, status: 'pending' }],
      },
    ]
    expect(isProposalPromotedToAgent(messages, 'p1')).toBe(true)
  })
})
