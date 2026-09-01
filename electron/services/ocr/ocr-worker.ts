import { createWorker, type Worker } from 'tesseract.js'

let workerPromise: Promise<Worker> | null = null

export async function getOcrWorker(): Promise<Worker> {
  workerPromise ??= createWorker('chi_sim+eng', 1, {
    logger: () => {
      // 主进程 OCR 不刷屏
    },
  })
  return workerPromise
}

export async function shutdownOcrWorker(): Promise<void> {
  if (!workerPromise) return
  const worker = await workerPromise
  await worker.terminate()
  workerPromise = null
}
