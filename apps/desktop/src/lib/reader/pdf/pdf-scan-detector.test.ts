import { describe, expect, it, vi } from 'vitest'
import { detectPdfDocumentProfile, resolvePdfProfileSamplePages } from './pdf-scan-detector'
import type { PDFDocumentProxy } from 'pdfjs-dist'

const LONG_TEXT = '这是一段足够长的可提取文字内容'

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

describe('resolvePdfProfileSamplePages', () => {
  it('不足 3 页时全抽样', () => {
    expect(resolvePdfProfileSamplePages(2)).toEqual([1, 2])
  })

  it('多页时加抽中间与末尾', () => {
    expect(resolvePdfProfileSamplePages(10)).toEqual([1, 2, 3, 5, 10])
  })
})

describe('detectPdfDocumentProfile', () => {
  it('无文字层时判定为扫描版', async () => {
    const pdf = createPdfMock({ 1: '', 2: '', 3: '' })
    const profile = await detectPdfDocumentProfile(pdf)
    expect(profile.isScanned).toBe(true)
    expect(profile.mixed).toBe(false)
  })

  it('有足够文字层时判定为非扫描版', async () => {
    const pdf = createPdfMock({
      1: LONG_TEXT,
      2: '第二页同样有足够多的文字',
      3: '第三页继续足够多的文字内容',
    })
    const profile = await detectPdfDocumentProfile(pdf)
    expect(profile.isScanned).toBe(false)
    expect(profile.mixed).toBe(false)
  })

  it('前 3 页有文字但中尾无文字时判定为混合', async () => {
    const pdf = createPdfMock({ 1: LONG_TEXT, 2: LONG_TEXT, 3: LONG_TEXT, 5: '', 10: '' })
    const profile = await detectPdfDocumentProfile(pdf)
    expect(profile.sampledPages).toEqual([1, 2, 3, 5, 10])
    expect(profile.textlessPages).toEqual([5, 10])
    expect(profile.mixed).toBe(true)
    expect(profile.isScanned).toBe(false)
  })

  it('文字版仅末页空白也视为混合（单页 OCR 门禁放行，横幅与预识别不变）', async () => {
    const pdf = createPdfMock({ 1: LONG_TEXT, 2: LONG_TEXT, 3: LONG_TEXT, 4: '' })
    const profile = await detectPdfDocumentProfile(pdf)
    expect(profile.isScanned).toBe(false)
    expect(profile.mixed).toBe(true)
    expect(profile.textlessPages).toEqual([4])
  })
})
