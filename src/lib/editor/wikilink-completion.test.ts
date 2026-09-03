import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { createWikilinkCompletionSource, type WikilinkCandidate } from './wikilink-completion'

describe('wikilink-completion', () => {
  const candidates: WikilinkCandidate[] = [
    { name: 'Vue设计与实现.epub', path: 'books/Vue设计与实现.epub', kind: 'epub' },
    { name: 'React Hooks总结.md', path: 'notes/React Hooks总结.md', kind: 'markdown' },
    { name: '深入理解Java虚拟机.pdf', path: 'books/深入理解Java虚拟机.pdf', kind: 'pdf' },
  ]

  const source = createWikilinkCompletionSource(() => candidates)

  it('triggers on [[ and lists all candidates', () => {
    const state = EditorState.create({ doc: '测试链接 [[' })
    const context = new CompletionContext(state, 7, true)
    const res = source(context) as CompletionResult | null

    expect(res).not.toBeNull()
    expect(res?.from).toBe(5) // position of first '['
    expect(res?.options).toHaveLength(3)
  })

  it('filters candidates based on typed query', () => {
    const state = EditorState.create({ doc: '参考 [[Vue' })
    const context = new CompletionContext(state, 8, true)
    const res = source(context) as CompletionResult | null

    expect(res).not.toBeNull()
    expect(res?.options).toHaveLength(1)
    expect(res?.options?.[0]?.apply).toBe('[[Vue设计与实现.epub]]')
  })

  it('does not trigger without [[', () => {
    const state = EditorState.create({ doc: '普通文本 [单个括号' })
    const context = new CompletionContext(state, 10, true)
    const res = source(context)

    expect(res).toBeNull()
  })
})
