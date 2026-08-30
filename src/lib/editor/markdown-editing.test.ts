import { describe, expect, it } from 'vitest'
import { applyLinkTemplate, buildLinkTemplate, wrapRangeText } from './markdown-editing'

describe('markdown-editing', () => {
  it('为空选区插入加粗标记', () => {
    const result = wrapRangeText('hello', { from: 5, to: 5 }, '**', '**')

    expect(result.nextText).toBe('hello****')
    expect(result.selection).toEqual({ from: 7, to: 7 })
  })

  it('为选中文本添加斜体标记', () => {
    const result = wrapRangeText('hello world', { from: 6, to: 11 }, '*', '*')

    expect(result.nextText).toBe('hello *world*')
    expect(result.selection).toEqual({ from: 7, to: 12 })
  })

  it('生成链接模板并选中 URL', () => {
    const template = buildLinkTemplate('示例')

    expect(template.insert).toBe('[示例](https://)')
    expect(template.urlSelection).toEqual({ from: 5, to: 13 })
  })

  it('将选中文本替换为链接', () => {
    const result = applyLinkTemplate('点击 这里 继续', { from: 3, to: 5 })

    expect(result.nextText).toBe('点击 [这里](https://) 继续')
    expect(result.selection.from).toBeGreaterThan(3)
  })
})
