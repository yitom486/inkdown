import type { AcpChatMessage } from '@/stores/acp-chat-types'
import { isToolActiveStatus } from '@/stores/acp-chat-types'
import { enrichToolMessageWithChapterPlan } from '@/lib/agent/parse-chapter-mark-plan'
import { enrichToolMessageWithMarkProposal } from '@/lib/agent/parse-mark-proposal'

/** tool 消息 enrich：批注提议 + 章级建议。 */
export function enrichAcpToolMessage(message: AcpChatMessage): AcpChatMessage {
  return enrichToolMessageWithChapterPlan(
    enrichToolMessageWithMarkProposal(message, isToolActiveStatus),
    isToolActiveStatus,
  )
}
