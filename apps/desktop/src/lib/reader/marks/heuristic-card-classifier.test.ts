import { describe, expect, it } from 'vitest'
import { heuristicClassifyMark } from './heuristic-card-classifier'

describe('heuristicClassifyMark', () => {
  it('classifies RFC MUST constraint as method category with green color', () => {
    const text = 'The client MUST send initialize request before any other RPC.'
    const result = heuristicClassifyMark(text)

    expect(result.category).toBe('method')
    expect(result.color).toBe('green')
    expect(result.title).toBe('The client MUST send i...')
    expect(result.keyPoints.length).toBeGreaterThan(0)
  })

  it('classifies Chinese 强制规约 as method category', () => {
    const text = '所有外部调用必须经过权限沙箱拦截并进行审批。'
    const result = heuristicClassifyMark(text)

    expect(result.category).toBe('method')
    expect(result.color).toBe('green')
  })

  it('classifies quote marks as quote category with yellow color', () => {
    const text = '“知之为知之，不知为不知，是知也。”'
    const result = heuristicClassifyMark(text)

    expect(result.category).toBe('quote')
    expect(result.color).toBe('yellow')
  })

  it('classifies workflow and sequence keywords as diagram category with pink color', () => {
    const text = '用户点击后触发状态机流转与时序握手流程。'
    const result = heuristicClassifyMark(text)

    expect(result.category).toBe('diagram')
    expect(result.color).toBe('pink')
  })

  it('classifies question keywords as question category with orange color', () => {
    const text = '为什么在这个步骤需要保留视口滚动锚点？'
    const result = heuristicClassifyMark(text)

    expect(result.category).toBe('question')
    expect(result.color).toBe('orange')
  })

  it('defaults to concept category with blue color for general statements', () => {
    const text = '微晶毛玻璃材质是通过复合高斯模糊与发丝微边实现的现代视觉系统。'
    const result = heuristicClassifyMark(text)

    expect(result.category).toBe('concept')
    expect(result.color).toBe('blue')
  })
})
