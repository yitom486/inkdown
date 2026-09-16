import { describe, expect, it } from 'vitest'
import { inspectEditorBufferText } from './inspect-editor-buffer'

describe('inspectEditorBufferText', () => {
  it('按行命中：精确 total、行号 1-based、位置规则与库一致', () => {
    const result = inspectEditorBufferText('王道计是出版社\n普通行\n出版社是王道计', '王道计', 10)
    expect(result).toMatchObject({ query: '王道计', total: 2, truncated: false, limit: 10 })
    expect(result.hits).toHaveLength(2)
    expect(result.hits[0]).toMatchObject({
      source: 'editor-buffer',
      locator: { lineStart: 1 },
      matchPosition: 'start',
    })
    expect(result.hits[1]).toMatchObject({
      locator: { lineStart: 3 },
      matchPosition: 'end',
    })
    expect(result.hits[0]?.locator).not.toHaveProperty('pageNumber')
    expect(result.hits[0]?.locator).not.toHaveProperty('blockId')
  })

  it('limit 截断不影响精确 total', () => {
    const text = Array.from({ length: 5 }, (_, i) => `第${i + 1}行王道计`).join('\n')
    const result = inspectEditorBufferText(text, '王道计', 2)
    expect(result.total).toBe(5)
    expect(result.truncated).toBe(true)
    expect(result.hits.map((hit) => hit.locator.lineStart)).toEqual([1, 2])
  })

  it('空文本与零命中返回 total=0 合法结果', () => {
    expect(inspectEditorBufferText('', '王道计', 10)).toMatchObject({ total: 0, hits: [] })
    expect(inspectEditorBufferText('纯正文', '王道计', 10)).toMatchObject({
      total: 0,
      hits: [],
      truncated: false,
    })
  })

  it('超长行开窗截断并标记', () => {
    const text = `${'正'.repeat(2000)}王道计${'文'.repeat(2000)}`
    const result = inspectEditorBufferText(text, '王道计', 10)
    expect(result.total).toBe(1)
    expect(result.hits[0]?.text).toContain('王道计')
    expect(result.hits[0]?.text.length).toBeLessThanOrEqual(1200)
    expect(result.hits[0]?.textTruncated).toBe(true)
  })
})
