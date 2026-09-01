import type { Worker } from 'tesseract.js'

/** 识别并返回含 blocks/words 坐标的完整结果（划词需要 bbox） */
export async function recognizeImageWithBlocks(worker: Worker, image: Buffer) {
  return worker.recognize(image, {}, { blocks: true })
}
