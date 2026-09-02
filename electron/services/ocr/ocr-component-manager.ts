import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { createWorker } from 'tesseract.js'
import { err, ok, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import { IPC } from '@shared/ipc/channels'
import type { OcrComponentStatus } from '@shared/types/ocr'
import { resolveTesseractCachePath, resolveTesseractWorkerOptions } from './tesseract-config'

export const OCR_REQUIRED_LANGS = ['chi_sim', 'eng'] as const

let lastStatus: OcrComponentStatus = {
  phase: 'not-ready',
  progress: 0,
  languages: [],
  missingLanguages: [...OCR_REQUIRED_LANGS],
}

let ensurePromise: Promise<Result<void, AppError>> | null = null
let cancelRequested = false
let activeDownloadWorker: Awaited<ReturnType<typeof createWorker>> | null = null

async function langPackExists(cachePath: string, lang: string): Promise<boolean> {
  try {
    await access(join(cachePath, `${lang}.traineddata`))
    return true
  } catch {
    return false
  }
}

function broadcastOcrComponentStatus(status: OcrComponentStatus): void {
  lastStatus = status
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC.OCR_COMPONENT_STATUS, status)
    }
  }
}

export async function inspectOcrComponentStatus(): Promise<OcrComponentStatus> {
  const cachePath = await resolveTesseractCachePath()
  const languages: string[] = []
  const missingLanguages: string[] = []

  for (const lang of OCR_REQUIRED_LANGS) {
    if (await langPackExists(cachePath, lang)) {
      languages.push(lang)
    } else {
      missingLanguages.push(lang)
    }
  }

  const status: OcrComponentStatus =
    missingLanguages.length === 0
      ? {
          phase: 'ready',
          progress: 100,
          message: 'OCR 语言包已就绪',
          languages,
          missingLanguages,
        }
      : {
          phase:
            missingLanguages.length === 0
              ? 'ready'
              : ensurePromise
                ? 'downloading'
                : lastStatus.phase === 'error'
                  ? 'error'
                  : 'not-ready',
          progress:
            ensurePromise && lastStatus.phase === 'downloading' ? lastStatus.progress : 0,
          message:
            missingLanguages.length === OCR_REQUIRED_LANGS.length
              ? '首次 OCR 需下载中英语言包（约 20MB）'
              : `缺少语言包：${missingLanguages.join('、')}`,
          languages,
          missingLanguages,
        }

  lastStatus = status
  return status
}

export function getOcrComponentStatus(): OcrComponentStatus {
  return lastStatus
}

export async function ensureOcrComponent(): Promise<Result<void, AppError>> {
  const current = await inspectOcrComponentStatus()
  if (current.phase === 'ready') {
    broadcastOcrComponentStatus(current)
    return ok(undefined)
  }

  if (ensurePromise) return ensurePromise

  ensurePromise = (async (): Promise<Result<void, AppError>> => {
    cancelRequested = false
    broadcastOcrComponentStatus({
      ...current,
      phase: 'downloading',
      progress: 0,
      message: '正在下载 OCR 语言包…',
    })

    try {
      const options = await resolveTesseractWorkerOptions()
      const worker = await createWorker([...OCR_REQUIRED_LANGS], 1, {
        ...options,
        logger: (message) => {
          if (cancelRequested) return
          broadcastOcrComponentStatus({
            phase: 'downloading',
            progress: Math.round(message.progress * 100),
            message: message.status,
            languages: current.languages,
            missingLanguages: current.missingLanguages,
          })
        },
      })
      activeDownloadWorker = worker

      if (cancelRequested) {
        await worker.terminate()
        activeDownloadWorker = null
        const cancelled = await inspectOcrComponentStatus()
        broadcastOcrComponentStatus(cancelled)
        return err({ code: 'CANCELLED', message: '已取消下载' })
      }

      await worker.terminate()
      activeDownloadWorker = null

      const ready = await inspectOcrComponentStatus()
      if (ready.phase !== 'ready') {
        const failed: OcrComponentStatus = {
          ...ready,
          phase: 'error',
          message: '语言包下载未完成，请重试',
        }
        broadcastOcrComponentStatus(failed)
        return err({ code: 'OCR_FAILED', message: failed.message ?? '语言包下载失败' })
      }

      broadcastOcrComponentStatus(ready)
      return ok(undefined)
    } catch (cause) {
      activeDownloadWorker = null
      const failed: OcrComponentStatus = {
        ...(await inspectOcrComponentStatus()),
        phase: 'error',
        message: cause instanceof Error ? cause.message : '语言包下载失败',
      }
      broadcastOcrComponentStatus(failed)
      return err({
        code: 'OCR_FAILED',
        message: failed.message ?? '语言包下载失败',
      })
    }
  })().finally(() => {
    ensurePromise = null
  })

  return await ensurePromise
}

export async function cancelOcrComponentDownload(): Promise<OcrComponentStatus> {
  cancelRequested = true
  if (activeDownloadWorker) {
    await activeDownloadWorker.terminate()
    activeDownloadWorker = null
  }
  const status = await inspectOcrComponentStatus()
  broadcastOcrComponentStatus(status)
  return status
}
