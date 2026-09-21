import { describe, expect, it } from 'vitest'
import { canonicalAnchorKey, type ReadingAnchor } from './reading-mark'

describe('canonicalAnchorKey', () => {
  it('epub：href 归一化 + cfiRange 优先', () => {
    const anchor: ReadingAnchor = {
      format: 'epub',
      cfi: 'epubcfi(/6/2)',
      cfiRange: 'epubcfi(/6/10!/4/2)',
      href: 'Text/Editor-Note.xhtml#frag',
    }
    expect(canonicalAnchorKey(anchor)).toBe('epub|text/editor-note.xhtml|epubcfi(/6/10!/4/2)')
  })

  it('epub 无 href/cfi：空段占位，键仍稳定', () => {
    const anchor = { format: 'epub', cfi: '' } as unknown as ReadingAnchor
    expect(canonicalAnchorKey(anchor)).toBe('epub||')
  })

  it('pdf：同页不同选区键不同；V1 只有页', () => {
    const v2a: ReadingAnchor = {
      format: 'pdf',
      page: 19,
      version: 2,
      begin: { itemIndex: 4, offset: 0 },
      end: { itemIndex: 4, offset: 12 },
    }
    const v2b: ReadingAnchor = {
      format: 'pdf',
      page: 19,
      version: 2,
      begin: { itemIndex: 9, offset: 0 },
      end: { itemIndex: 9, offset: 5 },
    }
    const v1: ReadingAnchor = { format: 'pdf', page: 19 }
    expect(canonicalAnchorKey(v2a)).toBe('pdf|19|4,0-4,12')
    expect(canonicalAnchorKey(v2b)).toBe('pdf|19|9,0-9,5')
    expect(canonicalAnchorKey(v1)).toBe('pdf|19|-')
    expect(new Set([canonicalAnchorKey(v2a), canonicalAnchorKey(v2b), canonicalAnchorKey(v1)]).size).toBe(3)
  })

  it('mobi：chapterId 归一化 + cfi；web：url + heading', () => {
    expect(
      canonicalAnchorKey({ format: 'mobi', chapterId: 'Mobi-Ch1', cfiRange: 'r1' }),
    ).toBe('mobi|mobi-ch1|r1')
    expect(canonicalAnchorKey({ format: 'mobi', chapterId: 'c1' })).toBe('mobi|c1|')
    expect(
      canonicalAnchorKey({ format: 'web', url: 'https://example.com/a', headingId: 's2' }),
    ).toBe('web|https://example.com/a|s2')
  })

  it('同一段正文多卡同键（一对多的数据基础）', () => {
    const anchor: ReadingAnchor = { format: 'epub', cfi: 'c', cfiRange: 'r', href: 'ch.xhtml' }
    expect(canonicalAnchorKey(anchor)).toBe(canonicalAnchorKey({ ...anchor }))
  })
})
