import { describe, expect, it } from 'vitest'
import { nextCopyName } from './workspace-fs'

describe('nextCopyName', () => {
  it('returns original when free', () => {
    expect(nextCopyName('a.md', new Set())).toBe('a.md')
  })

  it('appends copy suffix', () => {
    expect(nextCopyName('a.md', new Set(['a.md']))).toBe('a copy.md')
    expect(nextCopyName('a.md', new Set(['a.md', 'a copy.md']))).toBe('a copy 2.md')
  })

  it('handles names without extension', () => {
    expect(nextCopyName('notes', new Set(['notes']))).toBe('notes copy')
  })
})
