/**
 * OCR 目录可用性判定（纯函数）。
 *
 * 背景：混合型 PDF（部分页原生文字、部分页扫描图）在没有内置目录时，
 * 之前拿不到 OCR 目录入口（各处 UI 只判断 isScannedPdf），已缓存的 OCR
 * 目录也不会恢复。这里收敛为单一语义判定，避免多处分支再次漂移。
 *
 * 规则（自建目录压过内置书签）：
 * - PDF 自带书签只是参考（页标签、版权页也可能进来），不锁入口；
 *   扫描或混合（含 embedded）→ 可用（手动发起识别 + 恢复有效缓存）。
 * - 自建目录一旦保存（outlineSource='ocr'）即为准：侧栏/切章/入库全走它；
 *   只有用户「清除缓存」丢掉目录缓存后，才退回书签（embedded）或 page-fallback。
 * - 纯文字 PDF（两者皆否）→ 不可用，不打扰。
 * - outlineSource 为 ocr（已识别/已恢复）时沿用可用，保证
 *   “重新识别目录”等后续入口不断（调用方仍需自行判断 source 展示哪个按钮）。
 */
export interface OcrTocAvailabilityInput {
  isScannedPdf: boolean
  isMixedPdf: boolean
  /** 'embedded' | 'page-fallback' | 'ocr'（PdfViewer 侧栏目录来源） */
  outlineSource: string
}

export function canUseOcrToc(input: OcrTocAvailabilityInput): boolean {
  if (input.outlineSource === 'ocr') return true
  if (!input.isScannedPdf && !input.isMixedPdf) return false
  // 扫描/混合：embedded 不再一票否决（书签只作退回态）
  return true
}
