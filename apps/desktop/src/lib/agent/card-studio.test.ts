import { describe, expect, it } from 'vitest'
import { parseAiCardJson } from './card-studio'

const valid = JSON.stringify({
  title: '托克维尔的旅行动机',
  category: 'concept',
  aiSummary: '以问题与研究定义旅行者，而非语言熟练度。',
  keyPoints: ['问题导向', '不知疲倦的发问'],
})

describe('parseAiCardJson', () => {
  it('合法 JSON 原样过', () => {
    expect(parseAiCardJson(valid, 'auto', '摘录')).toEqual({
      title: '托克维尔的旅行动机',
      category: 'concept',
      aiSummary: '以问题与研究定义旅行者，而非语言熟练度。',
      keyPoints: ['问题导向', '不知疲倦的发问'],
    })
  })

  it('固定预设覆盖模型分类（用户点的说了算）', () => {
    const parsed = parseAiCardJson(valid, 'quote', '摘录')!
    expect(parsed.category).toBe('quote')
  })

  it('auto 下非法分类整个打回（调用方回启发式）', () => {
    const raw = JSON.stringify({
      title: '题',
      category: 'nope',
      aiSummary: '要义',
      keyPoints: ['k1'],
    })
    expect(parseAiCardJson(raw, 'auto', '摘录')).toBeNull()
  })

  it('缺字段/非 JSON 打回', () => {
    expect(parseAiCardJson('not json', 'auto', '摘录')).toBeNull()
    expect(
      parseAiCardJson(JSON.stringify({ title: '只有标题' }), 'auto', '摘录'),
    ).toBeNull()
    expect(
      parseAiCardJson(
        JSON.stringify({ title: '题', aiSummary: '义', keyPoints: [] }),
        'auto',
        '摘录',
      ),
    ).toBeNull()
  })
})
