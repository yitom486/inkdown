import { describe, expect, it } from 'vitest'
import {
  buildEvaluationPrompt,
  buildSingleQuestionPrompt,
  evaluateFallbackAnswer,
  generateFallbackQuestion,
  parseEvaluationResponse,
  parseQuestionResponse,
} from './quiz-evaluator'
import type { QuizQuestion } from '@shared/types/quiz'

describe('quiz-evaluator', () => {
  it('builds question prompt containing passage and chapter', () => {
    const prompt = buildSingleQuestionPrompt('满纸荒唐言，一把辛酸泪。', '第一回')
    expect(prompt).toContain('满纸荒唐言')
    expect(prompt).toContain('第一回')
    expect(prompt).toContain('json')
  })

  it('parses valid question JSON from markdown response', () => {
    const raw = `
当然，这里为您准备的深度思考题如下：
\`\`\`json
{
  "title": "太虚幻境与命运谶语辨析",
  "prompt": "请结合贾宝玉梦游太虚幻境的经历，分析作者如何借判词实现‘预叙’手法的运用？",
  "keyPoints": ["判词与人物悲剧命运的映射", "宏观预叙结构的文学功能"]
}
\`\`\`
希望对您的阅读有所启发！
`
    const parsed = parseQuestionResponse(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.title).toBe('太虚幻境与命运谶语辨析')
    expect(parsed?.keyPoints).toHaveLength(2)
  })

  it('builds evaluation prompt with question and user answer', () => {
    const q: QuizQuestion = {
      id: 'q1',
      title: '测试题目',
      prompt: '请分析作者意图。',
      keyPoints: ['要点1', '要点2'],
      sourceExcerpt: '这是原书段落。',
    }
    const evalPrompt = buildEvaluationPrompt(q, '我的作答是关于要点1的深入分析。')
    expect(evalPrompt).toContain('测试题目')
    expect(evalPrompt).toContain('这是原书段落')
    expect(evalPrompt).toContain('我的作答是关于要点1')
  })

  it('parses valid evaluation JSON response and assigns proper grade', () => {
    const raw = `
\`\`\`json
{
  "score": 92,
  "hitKeyPoints": ["要点1"],
  "missedKeyPoints": ["要点2"],
  "feedback": "作答精准，逻辑严密，建议后续关注结构呼应。"
}
\`\`\`
`
    const parsed = parseEvaluationResponse(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.score).toBe(92)
    expect(parsed?.grade).toBe('A')
    expect(parsed?.hitKeyPoints).toContain('要点1')
  })

  it('provides sensible fallback question and evaluation when offline', () => {
    const fallbackQ = generateFallbackQuestion('三十年为一世，而道更也。', '编者按', 'mark-1')
    expect(fallbackQ.sourceExcerpt).toBe('三十年为一世，而道更也。')
    expect(fallbackQ.markId).toBe('mark-1')

    const fallbackEval = evaluateFallbackAnswer(
      fallbackQ,
      '作者认为三十年是一个时代的大周期，思想与社会结构在此发生更替。',
    )
    expect(fallbackEval.score).toBeGreaterThan(60)
    expect(fallbackEval.feedback).toContain('字')
  })

  it('parses raw unfenced JSON with leading conversational preamble', () => {
    const raw = `Natural English: Please design an insightful deep-reading question about the highlighted passage and provide two or three standard scoring points in the specified JSON format.
{
  "title": "多重视角下的中国农村研究",
  "prompt": "这四部著作分别从受苦者叙事、农民反行为、村庄生活和农业不确定性等角度研究中国农村。它们共同提示我们：理解农村历史是否必须结合个体经验、社会行为、村庄日常与次级结构？请说明这些视角之间可能形成的互补关系，并分析单一视角可能带来的局限。",
  "keyPoints": [
    "指出四部著作分别代表微观故事、社会行为、村庄生活与宏观结构的相互补充。",
    "说明综合这些视角有助于把个体苦难、群体行动、日常生活的制度或环境因素联系起来。",
    "能够批判性分析单一视角的局限，如过度微观化、忽视主体经验、或过度抽象化、难以解释整体机制。"
  ]
}`
    const parsed = parseQuestionResponse(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.title).toBe('多重视角下的中国农村研究')
    expect(parsed?.prompt).toContain('这四部著作分别从受苦者叙事')
    expect(parsed?.keyPoints).toHaveLength(3)
  })
})
