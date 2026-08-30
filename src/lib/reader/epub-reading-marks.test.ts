// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { getEpubAnnotationType, getReadingMarkKindLabel, getReadingMarkLabel, isPointInMarkGroup } from './epub-reading-marks'
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

describe('isPointInMarkGroup', () => {
  it('检测点是否落在标注区域内', () => {
    const group = document.createElement('g')
    group.getClientRects = () => [new DOMRect(10, 10, 40, 12)] as unknown as DOMRectList
    expect(isPointInMarkGroup(group, 20, 16)).toBe(true)
    expect(isPointInMarkGroup(group, 100, 100)).toBe(false)
  })
})

describe('getEpubAnnotationType', () => {
  it('批注用 underline，重点用 highlight', () => {
    expect(
      getEpubAnnotationType({
        ...baseMark,
        kind: 'note',
        excerpt: '一段原文',
      }),
    ).toBe('underline')
    expect(getEpubAnnotationType({ ...baseMark, kind: 'note' })).toBe('underline')
    expect(getEpubAnnotationType({ ...baseMark, kind: 'highlight' })).toBe('highlight')
  })
})

describe('getReadingMarkKindLabel', () => {
  it('返回中文类型', () => {
    expect(getReadingMarkKindLabel('highlight')).toBe('重点')
  })
})
