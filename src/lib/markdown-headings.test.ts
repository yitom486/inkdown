import { describe, expect, it } from 'vitest'
import {
  assignHeadingIds,
  findActiveHeading,
  findActiveHeadingByPositions,
  parseMarkdownHeadings,
  slugifyHeading,
} from './markdown-headings'

describe('markdown-headings', () => {
  it('解析文档标题并分配稳定 id', () => {
    const content = ['# Hello', '## World', '### Hello'].join('\n')
    const headings = parseMarkdownHeadings(content)

    expect(headings).toHaveLength(3)
    expect(headings[0]).toMatchObject({ level: 1, text: 'Hello', line: 0, id: 'hello' })
    expect(headings[2]?.id).toBe('hello-1')
  })

  it('为重复 slug 追加序号', () => {
    expect(assignHeadingIds(['标题', '标题', '其他'])).toEqual(['标题', '标题-1', '其他'])
  })

  it('slugify 清理 Markdown 行内语法', () => {
    expect(slugifyHeading('**Bold** `code`')).toBe('bold-code')
  })

  it('根据编辑器可见行定位当前标题', () => {
    const headings = parseMarkdownHeadings(['# A', '## B', '## C'].join('\n'))

    expect(findActiveHeading(headings, 0)?.id).toBe('a')
    expect(findActiveHeading(headings, 1)?.id).toBe('b')
    expect(findActiveHeading(headings, 2)?.id).toBe('c')
  })

  it('根据预览 scrollTop 定位当前标题', () => {
    const headings = parseMarkdownHeadings(['# A', '## B', '## C'].join('\n'))
    const positions = [
      { id: 'a', top: 0 },
      { id: 'b', top: 120 },
      { id: 'c', top: 240 },
    ]

    expect(findActiveHeadingByPositions(headings, positions, 0)?.id).toBe('a')
    expect(findActiveHeadingByPositions(headings, positions, 150)?.id).toBe('b')
    expect(findActiveHeadingByPositions(headings, positions, 300)?.id).toBe('c')
  })
})
