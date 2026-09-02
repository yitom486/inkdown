import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { WorkerOptions } from 'tesseract.js'
import { resolveTesseractRoot } from './ocr-runtime'

/** tesseract.js 语言包缓存目录（首次 OCR 时从 CDN 下载） */
export async function resolveTesseractCachePath(): Promise<string> {
  const cachePath = join(app.getPath('userData'), 'ocr-tessdata')
  await mkdir(cachePath, { recursive: true })
  return cachePath
}

/** Electron 主进程：禁用 Blob worker，语言包写入 userData */
export async function resolveTesseractWorkerOptions(): Promise<Partial<WorkerOptions>> {
  const cachePath = await resolveTesseractCachePath()
  const tesseractRoot = await resolveTesseractRoot()

  return {
    cachePath,
    workerBlobURL: false,
    gzip: true,
    workerPath: join(tesseractRoot, 'src/worker-script/node/index.js'),
    logger: (message) => {
      if (message.status === 'loading tesseract core' || message.status === 'initializing tesseract') {
        console.info('[ocr]', message.status, `${Math.round(message.progress * 100)}%`)
      }
    },
    errorHandler: (error) => {
      console.warn('[ocr] tesseract worker error:', error)
    },
  }
}
