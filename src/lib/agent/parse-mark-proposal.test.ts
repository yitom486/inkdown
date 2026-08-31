import { describe, expect, it } from 'vitest'
import {
  isProposeMarkToolTitle,
  parseMarkProposalFromTool,
  parseMarkProposalToolResult,
} from '@/lib/agent/parse-mark-proposal'

describe('parse-mark-proposal', () => {
  it('识别 propose 工具名', () => {
    expect(isProposeMarkToolTitle('inkdown_propose_note')).toBe(true)
    expect(isProposeMarkToolTitle('inkdown_create_note')).toBe(true)
    expect(isProposeMarkToolTitle('Read file')).toBe(false)
  })

  it('解析工具 JSON 结果', () => {
    const parsed = parseMarkProposalToolResult(
      JSON.stringify({
        proposed: true,
        note: '我的批注',
        excerpt: '原文摘录',
        message: '等待确认',
      }),
    )
    expect(parsed).toEqual({
      proposed: true,
      note: '我的批注',
      excerpt: '原文摘录',
      message: '等待确认',
    })
  })

  it('从工具卡内容生成 ProposedMark', () => {
    const mark = parseMarkProposalFromTool(
      'inkdown_propose_note',
      JSON.stringify({ proposed: true, note: '', excerpt: '关键句', message: '' }),
      'call-1',
    )
    expect(mark?.kind).toBe('highlight')
    expect(mark?.excerpt).toBe('关键句')
    expect(mark?.id).toBe('tool:call-1')
  })

  it('从 JSON 内容识别提议，不要求工具标题', () => {
    const mark = parseMarkProposalFromTool(
      '工具调用',
      JSON.stringify({ proposed: true, note: '批注', excerpt: '原文', message: '' }),
      'call-2',
    )
    expect(mark?.note).toBe('批注')
  })

  it('非 propose JSON 返回 null', () => {
    expect(parseMarkProposalFromTool('grep', '{"ok":true}')).toBeNull()
    expect(parseMarkProposalToolResult('not json')).toBeNull()
  })
})
