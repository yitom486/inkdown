import { describe, expect, it } from 'vitest'
import { canUseOcrToc } from './pdf-ocr-toc-gate'

describe('canUseOcrToc', () => {
  it('纯扫描无内置目录：可用（现有行为不变）', () => {
    expect(
      canUseOcrToc({ isScannedPdf: true, isMixedPdf: false, outlineSource: 'page-fallback' }),
    ).toBe(true)
  })

  it('混合无内置目录：可用（本次新增）', () => {
    expect(
      canUseOcrToc({ isScannedPdf: false, isMixedPdf: true, outlineSource: 'page-fallback' }),
    ).toBe(true)
  })

  it('有内置目录：混合与纯扫描都不用 OCR（不覆盖）', () => {
    expect(
      canUseOcrToc({ isScannedPdf: false, isMixedPdf: true, outlineSource: 'embedded' }),
    ).toBe(false)
    expect(
      canUseOcrToc({ isScannedPdf: true, isMixedPdf: false, outlineSource: 'embedded' }),
    ).toBe(false)
  })

  it('纯文字 PDF：不可用（不打扰）', () => {
    expect(
      canUseOcrToc({ isScannedPdf: false, isMixedPdf: false, outlineSource: 'page-fallback' }),
    ).toBe(false)
  })

  it('已是 OCR 目录：入口不断（重新识别/编辑/清除）', () => {
    expect(
      canUseOcrToc({ isScannedPdf: true, isMixedPdf: false, outlineSource: 'ocr' }),
    ).toBe(true)
    expect(
      canUseOcrToc({ isScannedPdf: false, isMixedPdf: true, outlineSource: 'ocr' }),
    ).toBe(true)
  })
})
