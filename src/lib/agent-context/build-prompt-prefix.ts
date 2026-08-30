import type { AcpContentBlock } from '@shared/types/acp'
import { collectActiveDocument, collectReadingState } from './collect-turn-context'
import { INKDOWN_STATIC_SKILL } from './inkdown-static-skill'
import { takeTurnContextDecision } from './should-attach-turn-context'
import { documentKey, formatTurnContextBlock } from './turn-context'

/**
 * 每次 session/prompt 的前缀：静态 Skill（可被上游缓存） + 可选的 turn-context。
 * 这些块不会进入本地聊天时间线，用户看不到。
 */
export function buildInkdownPromptPrefix(threadId: string): AcpContentBlock[] {
  const blocks: AcpContentBlock[] = [{ type: 'text', text: INKDOWN_STATIC_SKILL }]

  const activeDocument = collectActiveDocument()
  const decision = takeTurnContextDecision(threadId, documentKey(activeDocument))
  if (!decision.attach) return blocks

  blocks.push({
    type: 'text',
    text: formatTurnContextBlock({
      documentChanged: decision.documentChanged,
      activeDocument,
      reading: collectReadingState(activeDocument),
    }),
  })
  return blocks
}
