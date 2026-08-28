import { describe, expect, it } from 'vitest'
import { getDocumentKind } from '@shared/types/document'

describe('document-types', () => {
  it('识别 Markdown、PDF、EPUB 与 MOBI', () => {
    expect(getDocumentKind('D:\\notes\\readme.md')).toBe('markdown')
    expect(getDocumentKind('/books/guide.epub')).toBe('epub')
    expect(getDocumentKind('C:\\docs\\paper.pdf')).toBe('pdf')
    expect(getDocumentKind('/books/legacy.mobi')).toBe('mobi')
    expect(getDocumentKind('image.png')).toBe('unknown')
  })
})
