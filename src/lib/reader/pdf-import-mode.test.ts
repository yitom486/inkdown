import { describe, expect, it } from 'vitest'
import { resolvePreferNativeImport } from './pdf-import-mode'

describe('resolvePreferNativeImport', () => {
  it('纯文字（非扫描非混合）才直提', () => {
    expect(resolvePreferNativeImport({ isScannedPdf: false, isMixedPdf: false })).toBe(true)
  })

  it('扫描/混合一律走 OCR 运行时', () => {
    expect(resolvePreferNativeImport({ isScannedPdf: true, isMixedPdf: false })).toBe(false)
    expect(resolvePreferNativeImport({ isScannedPdf: false, isMixedPdf: true })).toBe(false)
    expect(resolvePreferNativeImport({ isScannedPdf: true, isMixedPdf: true })).toBe(false)
  })
})
