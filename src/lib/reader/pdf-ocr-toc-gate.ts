/**
 * OCR 目录可用性判定（纯函数）。
 *
 * 背景：混合型 PDF（部分页原生文字、部分页扫描图）在没有内置目录时，
 * 之前拿不到 OCR 目录入口（各处 UI 只判断 isScannedPdf），已缓存的 OCR
 * 目录也不会恢复。这里收敛为单一语义判定，避免多处分支再次漂移。
 *
 * 规则：
 * - 有内置目录（embedded）一律不用 OCR 目录，不自动覆盖。
 * - 纯扫描或混合且无内置目录 → 可用（手动发起识别 + 恢复有效缓存）。
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
  if (input.outlineSource === 'embedded') return false
  return input.isScannedPdf || input.isMixedPdf
}
