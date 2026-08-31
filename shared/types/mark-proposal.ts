/** AI 提议的阅读标记（批注 / 高亮），须用户确认后才写入 marks 文件。 */
export type ProposedMarkKind = 'highlight' | 'note'

export type ProposedMarkSource = 'agent' | 'annotation'

export type MarkProposalStatus = 'pending' | 'adopted' | 'dismissed'

export interface ProposedMark {
  id: string
  kind: ProposedMarkKind
  excerpt: string
  note: string
  /** 位置提示（章名、视口等）；P2 起用于 resolveMarkTarget */
  locationHint?: string
  source: ProposedMarkSource
}

export interface MarkProposalToolResult {
  proposed: true
  note: string
  excerpt: string
  message: string
}

export function proposedMarkKind(note: string): ProposedMarkKind {
  return note.trim() ? 'note' : 'highlight'
}

export function toProposedMark(
  payload: Pick<ProposedMark, 'excerpt' | 'note'> & {
    id?: string
    locationHint?: string
    source?: ProposedMarkSource
  },
): ProposedMark {
  const note = payload.note ?? ''
  return {
    id: payload.id ?? `mark-${Date.now().toString(36)}`,
    kind: proposedMarkKind(note),
    excerpt: payload.excerpt ?? '',
    note,
    locationHint: payload.locationHint,
    source: payload.source ?? 'agent',
  }
}
