import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseAiCardJson } from './card-studio'

vi.mock('@/lib/agent/card-studio-session', () => ({
  sendCardStudioPrompt: vi.fn(),
}))

import { sendCardStudioPrompt } from '@/lib/agent/card-studio-session'
import { generateAiCardContent } from './card-studio'

const mockedSend = vi.mocked(sendCardStudioPrompt)

beforeEach(() => {
  vi.clearAllMocks()
})

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

  it('auto 下非法分类整个打回（无卡，不充数）', () => {
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

describe('generateAiCardContent', () => {
  const valid = JSON.stringify({
    title: '旅行动机',
    category: 'concept',
    aiSummary: '以问题定义旅行者。',
    keyPoints: ['发问'],
  })

  it('模型成功出卡', async () => {
    mockedSend.mockResolvedValue({ status: 'ok', reply: valid })
    const outcome = await generateAiCardContent({
      excerpt: '摘录正文',
      presetId: 'distill',
      bookKey: 'fp-1',
    })
    expect(outcome).toEqual({
      ok: true,
      card: {
        title: '旅行动机',
        category: 'concept',
        aiSummary: '以问题定义旅行者。',
        keyPoints: ['发问'],
        color: 'blue',
      },
    })
  })

  it('失败无卡：按因返回，不拿假卡充数', async () => {
    mockedSend.mockResolvedValue({ status: 'auth-required', reply: '' })
    expect(
      await generateAiCardContent({ excerpt: '摘录正文', presetId: 'distill', bookKey: 'fp-1' }),
    ).toEqual({ ok: false, reason: 'auth-required' })

    mockedSend.mockResolvedValue({ status: 'failed', reply: '' })
    expect(
      await generateAiCardContent({ excerpt: '摘录正文', presetId: 'distill', bookKey: 'fp-1' }),
    ).toEqual({ ok: false, reason: 'failed' })

    // 非法 JSON 同样无卡
    mockedSend.mockResolvedValue({ status: 'ok', reply: 'not json' })
    expect(
      await generateAiCardContent({ excerpt: '摘录正文', presetId: 'distill', bookKey: 'fp-1' }),
    ).toEqual({ ok: false, reason: 'failed' })
  })

  it('入参非法返回 null（调用方 toast 报错）', async () => {
    expect(await generateAiCardContent({ excerpt: '  ', presetId: 'distill', bookKey: 'fp-1' })).toBeNull()
    expect(await generateAiCardContent({ excerpt: '摘录', presetId: 'nope', bookKey: 'fp-1' })).toBeNull()
    expect(mockedSend).not.toHaveBeenCalled()
  })
})
