import { describe, expect, it } from 'vitest'
import { getDocumentKind } from '@shared/document-types'

describe('document-types', () => {
  it('识别 Markdown、PDF 与 EPUB', () => {
    expect(getDocumentKind('D:\\notes\\readme.md')).toBe('markdown')
    expect(getDocumentKind('/books/guide.epub')).toBe('epub')
    expect(getDocumentKind('C:\\docs\\paper.pdf')).toBe('pdf')
    expect(getDocumentKind('image.png')).toBe('unknown')
  })
})
