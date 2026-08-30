import { describe, expect, it } from 'vitest'
import {
  getDraftDisplayName,
  getDraftKey,
  isRecoverableDraft,
  pickLatestRecoverableDraft,
  type DocumentDraft,
} from './draft-utils'

describe('draft-utils', () => {
  it('未命名文档使用固定 draft 键', () => {
    expect(getDraftKey()).toBe('__untitled__')
    expect(getDraftKey('C:\\notes\\a.md')).toBe('C:\\notes\\a.md')
  })

  it('仅 content 与 baseline 不同时可恢复', () => {
    const draft: DocumentDraft = {
      content: 'hello',
      baselineContent: 'hi',
      updatedAt: 1,
    }
    expect(isRecoverableDraft(draft)).toBe(true)
    expect(isRecoverableDraft({ ...draft, content: 'hi' })).toBe(false)
  })

  it('选取最近的可恢复草稿', () => {
    const drafts: Record<string, DocumentDraft> = {
      a: { filePath: 'a.md', content: '1', baselineContent: '0', updatedAt: 10 },
      b: { filePath: 'b.md', content: '2', baselineContent: '0', updatedAt: 20 },
      c: { filePath: 'c.md', content: 'same', baselineContent: 'same', updatedAt: 30 },
    }

    expect(pickLatestRecoverableDraft(drafts)?.filePath).toBe('b.md')
  })

  it('生成草稿展示名称', () => {
    expect(getDraftDisplayName({ content: '', baselineContent: '', updatedAt: 0 })).toBe(
      '未命名文档',
    )
    expect(
      getDraftDisplayName({
        filePath: 'D:\\docs\\note.md',
        content: '',
        baselineContent: '',
        updatedAt: 0,
      }),
    ).toBe('note.md')
  })
})
