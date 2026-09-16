export interface PdfPageSizePt {
  width: number
  height: number
}

/**
 * 拷进独立 ArrayBuffer 再交给 pdf.js。getDocument({ data: TypedArray }) 会把
 * ArrayBuffer transfer 到 worker 并接管内存；导入四块 OCR 共用同一份 Buffer，
 * 若传入视图（含 Node Buffer 与 slab 共享 backing），transfer 后原
 * Buffer.byteLength 变成 0，下一块 processPdfWithOcr 报 file is empty。
 * 禁止 `new Uint8Array(data.buffer, data.byteOffset, data.byteLength)`。
 */
export function copyPdfBytesForPdfJs(data: Uint8Array): Uint8Array {
  return Uint8Array.from(data)
}
