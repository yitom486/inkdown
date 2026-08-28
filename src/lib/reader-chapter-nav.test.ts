import { describe, expect, it } from 'vitest'
import { resolveTopLevelChapterNav } from './reader-chapter-nav'

describe('resolveTopLevelChapterNav', () => {
  const chapters = [
    { label: '第一章', level: 0 },
    { label: '一、小引', level: 1 },
    { label: '第二章', level: 0 },
  ]

  it('从二级目录位置回溯到所属一级章节', () => {
    const nav = resolveTopLevelChapterNav(chapters, 1)
    expect(nav.current?.label).toBe('第一章')
    expect(nav.next?.label).toBe('第二章')
    expect(nav.previous).toBeNull()
  })
})
