import { describe, expect, it, vi } from 'vitest'
import { detectPdfDocumentProfile } from './pdf-scan-detector'
import type { PDFDocumentProxy } from 'pdfjs-dist'

function createPdfMock(textByPage: Record<number, string>): PDFDocumentProxy {
  return {
    numPages: Math.max(...Object.keys(textByPage).map(Number), 1),
    getPage: vi.fn(async (n: number) => ({
      getTextContent: async () => ({
        items: [{ str: textByPage[n] ?? '' }],
      }),
    })),
  } as unknown as PDFDocumentProxy
}

describe('detectPdfDocumentProfile', () => {
  it('无文字层时判定为扫描版', async () => {
    const pdf = createPdfMock({ 1: '', 2: '', 3: '' })
    const profile = await detectPdfDocumentProfile(pdf)
    expect(profile.isScanned).toBe(true)
  })

  it('有足够文字层时判定为非扫描版', async () => {
    const pdf = createPdfMock({
      1: '这是一段足够长的可提取文字内容',
      2: '第二页同样有足够多的文字',
      3: '第三页继续',
    })
    const profile = await detectPdfDocumentProfile(pdf)
    expect(profile.isScanned).toBe(false)
  })
})
