import type { AcpContentBlock } from '@inkdown/contracts'
import { collectActiveDocument, collectReaderLocationKey, collectReadingState, collectTocTopLevelForDocument } from './collect-turn-context'
import { INKDOWN_STATIC_SKILL, INKDOWN_TOOL_OVERVIEW } from './inkdown-static-skill'
import { beginPromptSelectionCycle } from './reader-selection-registry'
import { takeTurnContextDecision } from './should-attach-turn-context'
import { documentKey, formatTurnContextBlock } from './turn-context'

/**
 * 每次 session/prompt 的前缀：静态 Skill（可被上游缓存） + 可选的 turn-context。
 * 这些块不会进入本地聊天时间线，用户看不到。
 */
export function buildInkdownPromptPrefix(
  threadId: string,
  options: { includeBootstrap?: boolean } = {},
): AcpContentBlock[] {
  const blocks: AcpContentBlock[] = []
  if (options.includeBootstrap !== false) {
    blocks.push({ type: 'text', text: INKDOWN_STATIC_SKILL })
  }
  blocks.push({ type: 'text', text: INKDOWN_TOOL_OVERVIEW })

  // 选区只「通知一轮」：本轮若刚划选则 hasSelection；否则清掉上一轮 sticky
  const hasSelection = beginPromptSelectionCycle()
  const activeDocument = collectActiveDocument()
  const decision = takeTurnContextDecision(
    threadId,
    documentKey(activeDocument),
    undefined,
    hasSelection,
    collectReaderLocationKey(),
  )
  if (!decision.attach) return blocks

  const tocTopLevel = collectTocTopLevelForDocument(activeDocument)
  blocks.push({
    type: 'text',
    text: formatTurnContextBlock({
      documentChanged: decision.documentChanged,
      activeDocument,
      reading: collectReadingState(activeDocument),
      ...(hasSelection ? { hasSelection: true } : {}),
      ...(tocTopLevel ? { tocTopLevel } : {}),
    }),
  })
  return blocks
}
