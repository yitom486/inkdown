/**
 * 原生 PDF 文本质量（P1.3）。
 *
 * 只判断「这一页的原生提取是否空/乱码」：差则标记可选用 OCR，
 * 不得据此触发整书或整页自动 OCR。启发式宁缺毋滥：短标题页、
 * 图注等正常短文本视为 ok。
 */

export const NATIVE_PAGE_QUALITY_OK = 'ok'
export const NATIVE_PAGE_QUALITY_SUGGEST_OCR = 'suggest-ocr'

export type NativePageQuality =
  | typeof NATIVE_PAGE_QUALITY_OK
  | typeof NATIVE_PAGE_QUALITY_SUGGEST_OCR

/** IPC / 书信息里最多带多少个建议页，避免把整本页码塞进渲染端 */
export const OCR_SUGGESTED_PAGES_CAP = 100

const CID_TOKEN = /\(cid:\d+\)/gi

export function assessNativePageText(text: string): NativePageQuality {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return NATIVE_PAGE_QUALITY_SUGGEST_OCR
  const chars = [...trimmed]
  const length = chars.length
  let replacement = 0
  for (const char of chars) {
    if (char === '\uFFFD') replacement += 1
  }
  if (replacement / length >= 0.08) return NATIVE_PAGE_QUALITY_SUGGEST_OCR
  const cidHits = trimmed.match(CID_TOKEN)?.length ?? 0
  if (cidHits >= 3) return NATIVE_PAGE_QUALITY_SUGGEST_OCR
  if (cidHits > 0 && cidHits * 8 >= length) return NATIVE_PAGE_QUALITY_SUGGEST_OCR
  return NATIVE_PAGE_QUALITY_OK
}
