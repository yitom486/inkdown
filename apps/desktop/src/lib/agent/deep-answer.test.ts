import { describe, expect, it } from 'vitest'
import {
  buildDeepAnswerPrompt,
  DEEP_ANSWER_DIRECTIONS,
  getDeepAnswerDirection,
} from './deep-answer'

describe('deep-answer', () => {
  it('三方向齐全', () => {
    expect(DEEP_ANSWER_DIRECTIONS.map((direction) => direction.id)).toEqual([
      'explain',
      'summary',
      'compare',
    ])
  })

  it('组装含方向 directive + 原文，非 JSON 直答口径', () => {
    const direction = getDeepAnswerDirection('compare')!
    const prompt = buildDeepAnswerPrompt('  摘录正文  ', direction)
    expect(prompt).toContain(direction.directive)
    expect(prompt).toContain('<原文>\n摘录正文\n</原文>')
    expect(prompt).toContain('不要输出 JSON')
  })

  it('未知方向取不到（调用方 toast 报错不断流）', () => {
    expect(getDeepAnswerDirection('nope')).toBeNull()
  })
})
