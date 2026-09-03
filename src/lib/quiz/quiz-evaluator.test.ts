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
})
