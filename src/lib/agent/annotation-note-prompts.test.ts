import { describe, expect, it } from 'vitest'
import {
  buildAnnotationIntentPrompt,
  buildAnnotationRefinePrompt,
  extractAnnotationDraft,
} from './annotation-note-prompts'

describe('annotation-note-prompts', () => {
  it('意图 prompt 含选区与输出约束', () => {
    const built = buildAnnotationIntentPrompt({
      excerpt: '天下大势分久必合',
      intent: 'explain',
    })
    expect(built.displayText).toBe('解释这段')
    expect(built.promptText).toContain('天下大势分久必合')
    expect(built.promptText).toContain('不要调用 inkdown_create_note')
  })

  it('自定义意图使用用户原文', () => {
    const built = buildAnnotationIntentPrompt({
      excerpt: '选区',
      intent: 'custom',
      customText: '联系后文矛盾',
    })
    expect(built.displayText).toBe('联系后文矛盾')
    expect(built.promptText).toContain('联系后文矛盾')
  })

  it('改写 prompt 带上当前草稿', () => {
    const built = buildAnnotationRefinePrompt({
      excerpt: '原文',
      draft: '旧草稿',
      refine: 'shorter',
    })
    expect(built.displayText).toBe('更短')
    expect(built.promptText).toContain('旧草稿')
  })

  it('extractAnnotationDraft 去掉围栏与前缀', () => {
    expect(extractAnnotationDraft('```\n批注正文\n```')).toBe('批注正文')
    expect(extractAnnotationDraft('批注：这里有观点')).toBe('这里有观点')
  })
})
