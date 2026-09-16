/**
 * Agent 全书搜索闸门（S1，纯函数）。
 *
 * 未入库扫描版/混合版 PDF 禁止进入逐页 iterateUnits：否则会按页触发 OCR
 *（pdfOcrAgentAutoOcr 默认 true），整书跑下来用户毫无察觉。拦截时返回
 * 固定中文原因，调用方抛错；返回 null 表示放行。
 * EPUB/MOBI/在线文档不设此字段；文字版 PDF 未入库仍可内存搜索。
 */
export function resolvePdfAgentSearchBlock(input: {
  isScannedPdf: boolean
  isMixedPdf: boolean
  /** 与 PdfViewer 一致：Boolean(rosettaImport.info) */
  indexed: boolean
}): string | null {
  if ((input.isScannedPdf || input.isMixedPdf) && !input.indexed) {
    return '先建立罗盘索引，或手动单页识别'
  }
  return null
}
