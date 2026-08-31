export type { ProposeMarkOptions as ProposeNoteOptions } from '@/lib/agent/context/propose-mark'
export {
  adoptProposedMark as adoptProposedNote,
  dismissProposedMark as dismissProposedNote,
  proposeMarkForAgent as proposeNoteForAgent,
} from '@/lib/agent/context/propose-mark'

import { proposeMarkForAgent } from '@/lib/agent/context/propose-mark'

/** MCP inkdown_create_note / propose-note 快照入口 */
export async function createNoteForAgent(note: string) {
  const result = await proposeMarkForAgent(note, { source: 'agent' })
  return {
    proposed: result.proposed,
    note: result.note,
    excerpt: result.excerpt,
    message: result.message,
  }
}
