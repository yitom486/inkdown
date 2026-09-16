/**
 * 纯文字书直提判定（P1.2）：仅当既非扫描也非混合时走无 OCR 运行时路径。
 * 混合书仍需 OCR 运行时（其中扫描页要识别），不得标 native。
 */
export function resolvePreferNativeImport(input: {
  isScannedPdf: boolean
  isMixedPdf: boolean
}): boolean {
  return !input.isScannedPdf && !input.isMixedPdf
}

/**
 * P1.3：扫描版沿用「识别本页」；已入库且当前页被标为原生质量差时也露出入口。
 * 不得在导入时自动 OCR。
 */
export function shouldOfferPageOcr(input: {
  isScannedPdf: boolean
  currentPageOcrSuggested: boolean
}): boolean {
  return input.isScannedPdf || input.currentPageOcrSuggested
}
