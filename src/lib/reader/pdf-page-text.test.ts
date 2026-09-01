import { describe, expect, it, vi } from 'vitest'
import { pdfPageNeedsOcr, readPdfPageNativeText } from './pdf-page-text'
import type { PDFDocumentProxy } from 'pdfjs-dist'

describe('pdf-page-text', () => {
  it('pdfPageNeedsOcr 无嵌入文字时为 true', () => {
    expect(pdfPageNeedsOcr('')).toBe(true)
    expect(pdfPageNeedsOcr('ab')).toBe(true)
    expect(pdfPageNeedsOcr('这是一段足够长的嵌入文字内容')).toBe(false)
  })

  it('readPdfPageNativeText 拼接 text items', async () => {
    const pdf = {
      getPage: vi.fn(async () => ({
        getTextContent: async () => ({
          items: [{ str: 'hello' }, { str: ' world' }],
        }),
      })),
    } as unknown as PDFDocumentProxy
    await expect(readPdfPageNativeText(pdf, 1)).resolves.toBe('hello world')
  })
})
