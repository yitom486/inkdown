import { describe, expect, it } from 'vitest'
import { getReadingMarkKindLabel, getReadingMarkLabel } from './epub-reading-marks'
import type { ReadingMark } from '@shared/types/reading-mark'

const baseMark: ReadingMark = {
  id: '1',
  filePath: '/book.epub',
  fileFingerprint: 'fp',
  kind: 'note',
  anchor: { format: 'epub', cfi: 'cfi' },
  createdAt: 0,
  updatedAt: 0,
}

describe('getReadingMarkLabel', () => {
  it('优先使用 label', () => {
    expect(getReadingMarkLabel({ ...baseMark, label: '引言' })).toBe('引言')
  })

  it('无 label 时使用 excerpt 截断', () => {
    expect(getReadingMarkLabel({ ...baseMark, excerpt: '甲'.repeat(60) })).toContain('…')
  })

  it('fallback 到类型名', () => {
    expect(getReadingMarkLabel({ ...baseMark, kind: 'bookmark', excerpt: undefined })).toBe('书签')
  })
})

describe('getReadingMarkKindLabel', () => {
  it('返回中文类型', () => {
    expect(getReadingMarkKindLabel('highlight')).toBe('高亮')
  })
})
