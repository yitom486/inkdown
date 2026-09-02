import type { Worker } from 'tesseract.js'
import { loadCreateWorker } from './ocr-runtime'
import { resolveTesseractWorkerOptions } from './tesseract-config'

const OCR_LANGS = ['chi_sim', 'eng'] as const

let workerPromise: Promise<Worker> | null = null

export async function getOcrWorker(): Promise<Worker> {
  workerPromise ??= (async () => {
    const createWorker = await loadCreateWorker()
    const options = await resolveTesseractWorkerOptions()
    const worker = await createWorker([...OCR_LANGS], 1, options)
    return worker
  })()
  return workerPromise
}

export async function shutdownOcrWorker(): Promise<void> {
  if (!workerPromise) return
  const worker = await workerPromise
  await worker.terminate()
  workerPromise = null
}
