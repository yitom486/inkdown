import { describe, expect, it } from 'vitest'
import { classifyMarkProposalFailure } from './mark-proposal-failure'

describe('classifyMarkProposalFailure', () => {
  it('识别未找到摘录并可打开章 / 划词', () => {
    const guide = classifyMarkProposalFailure('未在当前页及相邻页找到该摘录，请翻到对应页后划词重试', 2)
    expect(guide.canSelectText).toBe(true)
    expect(guide.canOpenChapter).toBe(true)
    expect(guide.flatIndex).toBe(2)
  })

  it('识别阅读器未就绪', () => {
    const guide = classifyMarkProposalFailure('当前阅读器未就绪，无法定位标记')
    expect(guide.code).toBe('reader-not-ready')
    expect(guide.canOpenChapter).toBe(false)
    expect(guide.canSelectText).toBe(false)
  })
})
