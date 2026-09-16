/**
 * S1.2 已入库罗盘缺文错误（纯函数）。
 *
 * 已入库 PDF 的 Agent 正文只读库：库中无该页/章块时抛此错，禁止回退
 * inspector / WASM / OCR。文案即人话，可直接展示给用户与模型。
 */
export function rosettaPageMissingError(page: number): Error {
  return new Error(`本页罗盘无正文（第 ${page} 页），请重建索引或手动识别本页`)
}
